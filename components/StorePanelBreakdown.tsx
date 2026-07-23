import {
  formatStorePanelDimension,
  STORE_PANEL_WIDTH_CM,
  type StorePanelMeasurement,
} from "../lib/store-panel-count";

interface StorePanelBreakdownProps {
  panels: StorePanelMeasurement[];
  /** Slightly denser layout for admin forms */
  compact?: boolean;
}

export default function StorePanelBreakdown({
  panels,
  compact = false,
}: StorePanelBreakdownProps) {
  if (panels.length === 0) {
    return null;
  }

  const isSingle = panels.length === 1;
  const rowPad = compact ? "py-1.5" : "py-2";

  return (
    <div className={`rounded-lg bg-gray-50 dark:bg-gray-700 ${compact ? "p-3" : "p-4"}`}>
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {isSingle ? "1 rideau" : `${panels.length} rideaux`}
      </p>

      {isSingle ? (
        <p className={`text-sm text-gray-700 dark:text-gray-200 ${compact ? "mt-1.5" : "mt-2"}`}>
          Dimensions :{" "}
          <span className="font-medium tabular-nums text-gray-900 dark:text-white">
            {formatStorePanelDimension(panels[0].widthCm, panels[0].heightCm)}
          </span>
        </p>
      ) : (
        <ul className={compact ? "mt-2" : "mt-3"}>
          {panels.map((panel, index) => (
            <li
              key={panel.index}
              className={`flex items-center justify-between gap-3 text-sm ${rowPad} ${
                index > 0 ? "border-t border-gray-200/80 dark:border-gray-600/70" : ""
              }`}
            >
              <span className="text-gray-600 dark:text-gray-300">Rideau {panel.index}</span>
              <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                {formatStorePanelDimension(panel.widthCm, panel.heightCm)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Short hint shown before dimensions are complete. */
export function StorePanelQuantityHint() {
  return (
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Au-delà de {STORE_PANEL_WIDTH_CM} cm de large, la commande est découpée en plusieurs rideaux.
    </p>
  );
}
