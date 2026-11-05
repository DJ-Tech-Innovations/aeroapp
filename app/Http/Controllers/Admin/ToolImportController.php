<?php

namespace App\Http\Controllers\Admin;

use App\Domain\ToolBuilder;
use App\Domain\ToolExcel;
use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Tool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ToolImportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/tools/import', ['total' => Tool::count(), 'maxRows' => ToolExcel::MAX_ROWS, 'maxMb' => ToolExcel::MAX_BYTES / 1048576]);
    }

    public function template(): HttpResponse
    {
        return $this->xlsx(ToolExcel::workbook(null), 'aeroapp-tools-template.xlsx');
    }

    public function export(): HttpResponse
    {
        return $this->xlsx(ToolExcel::workbook(Tool::orderBy('sort_order')->orderBy('name')->get()), 'aeroapp-tools-'.now()->format('Y-m-d').'.xlsx');
    }

    /** Dry run: validates every row and reports what would happen. Saves nothing. */
    public function check(Request $request): JsonResponse
    {
        $plan = ToolExcel::plan($this->file($request));

        return response()->json(['rows' => $plan['rows'], 'problems' => $plan['problems']]);
    }

    /** Re-validates the same file and saves it only if every row is valid — all or nothing. */
    public function import(Request $request): JsonResponse
    {
        $plan = ToolExcel::plan($this->file($request));
        $bad = $plan['problems'] || collect($plan['rows'])->contains(fn ($r) => $r['errors']) || count($plan['inputs']) !== count($plan['rows']);
        if ($bad) {
            return response()->json(['message' => 'The file has errors. Fix them and check it again.', 'rows' => $plan['rows'], 'problems' => $plan['problems']], 422);
        }
        [$created, $updated] = DB::transaction(function () use ($plan) {
            $c = $u = 0;
            $sort = (int) Tool::max('sort_order') + 1;
            foreach ($plan['inputs'] as $i) {
                ToolBuilder::persist($i, empty($i['id']) ? $sort++ : null);
                empty($i['id']) ? $c++ : $u++;
            }

            return [$c, $u];
        });
        Activity::record('tool.imported', "{$created} new, {$updated} updated");

        return response()->json(['created' => $created, 'updated' => $updated]);
    }

    private function file(Request $request): string
    {
        $request->validate(['file' => ['required', 'file', 'max:'.(ToolExcel::MAX_BYTES / 1024), 'mimes:xlsx']], ['file.mimes' => 'Only .xlsx files are supported. In Excel use File → Save As → Excel Workbook (.xlsx).']);

        return $request->file('file')->getRealPath();
    }

    private function xlsx(string $bytes, string $name): HttpResponse
    {
        return response($bytes, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$name}\"",
        ]);
    }
}
