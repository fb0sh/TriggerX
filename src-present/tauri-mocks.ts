// Stub for @tauri-apps/* imports so the showcase builds in a regular browser.
export function invoke() {
  return Promise.reject(new Error("Tauri not available in showcase mode"));
}
export default { invoke };
