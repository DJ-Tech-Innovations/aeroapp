import { Euler, Quaternion, Vector3 } from 'three';

/** Mutable view state kept outside React so gestures never trigger renders. */
export interface ViewState { q: Quaternion; zoom: number; pan: Vector3; lastTouch: number; autoRotate: boolean }

const AX = new Vector3(1, 0, 0), AY = new Vector3(0, 1, 0), AZ = new Vector3(0, 0, 1);
const tmp = new Quaternion();

export const initialQuaternion = () => new Quaternion().setFromEuler(new Euler(0.35, -0.7, 0));
export const createViewState = (autoRotate: boolean): ViewState => ({ q: initialQuaternion(), zoom: 1, pan: new Vector3(), lastTouch: 0, autoRotate });
export const resetView = (v: ViewState) => { v.q.copy(initialQuaternion()); v.zoom = 1; v.pan.set(0, 0, 0); };

/** Trackball rotation: any drag spins the model about screen axes → unlimited 360° on every axis. */
export function rotateBy(v: ViewState, dx: number, dy: number, k = 0.011) {
  tmp.setFromAxisAngle(AY, dx * k); v.q.premultiply(tmp);
  tmp.setFromAxisAngle(AX, dy * k); v.q.premultiply(tmp);
}
export function rollBy(v: ViewState, rad: number) { tmp.setFromAxisAngle(AZ, rad); v.q.premultiply(tmp); }
export const zoomBy = (v: ViewState, scale: number) => { v.zoom = Math.min(4, Math.max(0.5, v.zoom * scale)); };
export const panBy = (v: ViewState, dx: number, dy: number, k = 0.004) => {
  v.pan.x = Math.max(-1.5, Math.min(1.5, v.pan.x + dx * k));
  v.pan.y = Math.max(-1.5, Math.min(1.5, v.pan.y - dy * k));
};
export const spinY = (v: ViewState, dt: number, speed = 0.6) => { tmp.setFromAxisAngle(AY, dt * speed); v.q.premultiply(tmp); };
