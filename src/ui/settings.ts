// src/ui/settings.ts
import { getSettings, setSettings } from "../state/settings";

export function initSettingsUI(host: HTMLElement) {
  host.innerHTML = "";
  const s = getSettings();

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3 style="margin:0 0 8px 0;">Settings</h3>
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-items:end">
      <label>Units
        <select id="st-units">
          <option value="mm">mm</option>
          <option value="in">in</option>
        </select>
      </label>
      <label>Kerf (mm)
        <input id="st-kerf" type="number" min="0" step="0.1" />
      </label>
      <label>Margin (mm)
        <input id="st-margin" type="number" min="0" step="0.1" />
      </label>
      <label>Show Labels
        <input id="st-showlabels" type="checkbox" />
      </label>
      <label>Show Dims
        <input id="st-showdims" type="checkbox" />
      </label>
    </div>
  `;
  host.appendChild(wrap);

  const units = wrap.querySelector("#st-units") as HTMLSelectElement;
  const kerf = wrap.querySelector("#st-kerf") as HTMLInputElement;
  const margin = wrap.querySelector("#st-margin") as HTMLInputElement;
  const showLabels = wrap.querySelector("#st-showlabels") as HTMLInputElement;
  const showDims = wrap.querySelector("#st-showdims") as HTMLInputElement;

  units.value = s.units;
  kerf.value = String(s.kerf);
  margin.value = String(s.margin);
  showLabels.checked = s.showLabels;
  showDims.checked = s.showDims;

  const push = () =>
    setSettings({
      units: units.value as any, // "mm" | "in"
      kerf: Number(kerf.value),
      margin: Number(margin.value),
      showLabels: showLabels.checked,
      showDims: showDims.checked,
    });

  [units, kerf, margin, showLabels, showDims].forEach((el) => {
    el.addEventListener("change", push);
    el.addEventListener("input", push);
  });
}
