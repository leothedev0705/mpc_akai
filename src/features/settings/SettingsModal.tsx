import { useUIStore } from '@/stores/uiStore';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const setRightSidebarOpen = useUIStore((s) => s.setRightSidebarOpen);

  return (
    <Modal open={open} onClose={() => setSettingsOpen(false)} title="Settings">
      <div className="space-y-5">
        <section>
          <h3 className="text-sm font-semibold mb-3">Interface</h3>
          <Toggle
            label="Show Pad Details Panel"
            checked={rightSidebarOpen}
            onChange={setRightSidebarOpen}
          />
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Q', 'W', 'E', 'R'],
              ['A', 'S', 'D', 'F'],
              ['Z', 'X', 'C', 'V'],
              ['1', '2', '3', '4'],
            ].map((row, ri) =>
              row.map((key) => (
                <div
                  key={`${ri}-${key}`}
                  className="hardware-btn rounded-lg py-2 text-xs font-mono text-muted"
                >
                  {key}
                </div>
              )),
            )}
          </div>
          <p className="text-[10px] text-muted mt-2">
            Edit shortcuts per pad in the Pad Details panel.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">About</h3>
          <p className="text-xs text-muted leading-relaxed">
            Web MPC v1.0 — A browser-based Music Production Center built with React and the Web Audio API.
            All projects and audio are stored locally in your browser.
          </p>
        </section>
      </div>
    </Modal>
  );
}
