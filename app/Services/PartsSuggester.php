<?php

namespace App\Services;

use Anthropic\Beta\Messages\BetaBase64ImageSource;
use Anthropic\Beta\Messages\BetaImageBlockParam;
use Anthropic\Beta\Messages\BetaTextBlockParam;
use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use App\Models\AppSecret;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/** Claude looks at a tool's photos and proposes the named parts a maintenance student should be able to identify. */
final class PartsSuggester
{
    public const MODEL = 'claude-opus-5-5';

    public const MAX_PARTS = 12;

    /**
     * @param  string[]  $photoPaths  paths on the public disk
     * @return array<int, array{name: string, purpose: string}>
     */
    public static function suggest(array $photoPaths, array $tool, string $prompt): array
    {
        $key = AppSecret::reveal('anthropic');
        if (! $key) {
            throw new RuntimeException('No Claude API key yet. Add it in Settings → AI services.');
        }
        $client = new Client(apiKey: $key);

        $images = array_map(fn ($p) => BetaImageBlockParam::with(source: BetaBase64ImageSource::with(data: self::jpeg($p), mediaType: 'image/jpeg')), $photoPaths);
        $context = implode("\n", array_filter([
            "Tool: {$tool['name']} ({$tool['brand']} {$tool['model']}).",
            ! empty($tool['purpose']) ? "Purpose: {$tool['purpose']}" : null,
            ! empty($tool['howItWorks']) ? "How it works: {$tool['howItWorks']}" : null,
        ]));

        try {
            $message = $client->beta->messages->create(
                model: self::MODEL,
                maxTokens: 16000,
                // On a policy decline the API re-runs the request on Anthropic's recommended fallback model.
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
                system: 'You help instructors build an aviation maintenance training app. Learners rotate a 3D model of a tool and tap labelled points to learn its parts. '
                    .'Identify the distinct, visible parts of the tool in the photos that a student should be able to name and use. Order them from most to least important. Return at most '.self::MAX_PARTS.' parts. '
                    .'Only name parts you can actually see or that are certainly present on this tool type; never invent features. Write for students: short names, plain-language purposes.',
                messages: [[
                    'role' => 'user',
                    'content' => [...$images, BetaTextBlockParam::with(text: "{$context}\n\nInstructor's instructions: ".(trim($prompt) ?: 'List the main parts.'))],
                ]],
                outputConfig: [
                    'effort' => 'medium',
                    'format' => [
                        'type' => 'json_schema',
                        'schema' => [
                            'type' => 'object',
                            'properties' => [
                                'parts' => [
                                    'type' => 'array',
                                    'items' => [
                                        'type' => 'object',
                                        'properties' => [
                                            'name' => ['type' => 'string', 'description' => 'Short part name as a technician would say it, e.g. "Anvil"'],
                                            'purpose' => ['type' => 'string', 'description' => 'One or two plain sentences: what this part does and how the learner uses it. Spoken aloud by the app.'],
                                        ],
                                        'required' => ['name', 'purpose'],
                                        'additionalProperties' => false,
                                    ],
                                ],
                            ],
                            'required' => ['parts'],
                            'additionalProperties' => false,
                        ],
                    ],
                ],
            );
        } catch (AuthenticationException) {
            throw new RuntimeException('Claude rejected the API key. Update it in Settings → AI services.');
        } catch (RateLimitException) {
            throw new RuntimeException('Claude is rate-limited right now. Try again in a minute.');
        } catch (APIStatusException $e) {
            throw new RuntimeException('Claude API error: '.$e->getMessage());
        } catch (APIConnectionException) {
            throw new RuntimeException('Could not reach Claude. Check the server’s internet connection.');
        }

        if ($message->stopReason === 'refusal') {
            throw new RuntimeException('Claude declined to analyse these photos.');
        }
        $json = null;
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $json = json_decode($block->text, true);
                break;
            }
        }
        if (! is_array($json['parts'] ?? null)) {
            throw new RuntimeException('Claude did not return a list of parts. Try again.');
        }

        return collect($json['parts'])->take(self::MAX_PARTS)
            ->map(fn ($p) => ['name' => trim((string) ($p['name'] ?? '')), 'purpose' => trim((string) ($p['purpose'] ?? ''))])
            ->filter(fn ($p) => $p['name'] !== '' && $p['purpose'] !== '')->values()->all();
    }

    /** Phone photos can exceed Claude's per-image limit; 1568 px on the long side is the most Claude uses anyway. */
    private static function jpeg(string $path): string
    {
        $raw = Storage::disk('public')->get($path) ?? throw new RuntimeException('A tool photo is missing.');
        $img = @imagecreatefromstring($raw) ?: throw new RuntimeException('A tool photo could not be read.');
        [$w, $h] = [imagesx($img), imagesy($img)];
        $s = min(1, 1568 / max($w, $h));
        if ($s < 1) {
            $img = imagescale($img, (int) round($w * $s), (int) round($h * $s));
        }
        ob_start();
        imagejpeg($img, null, 85);

        return base64_encode((string) ob_get_clean());
    }
}
