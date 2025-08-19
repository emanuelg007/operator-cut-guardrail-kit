// Vanilla UI: tiny settings panel; call initSettingsUI(container)
// Won’t interfere with your right-docked header mapping drawer.
import { getSettings, setSettings } from "../state/settings";

export function initSettingsUI(container: HTMLElement): void {
  const s = getSettings();
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:.75rem;">
      <label style="display:flex; justify-content:space-between; gap:.75rem;">
        <span>Units</span>
        <select id="units">
          <option value="mm"${s.units==="mm"?" selected":""}>mm</option>
          <option value="cm"${s.units==="cm"?" selected":""}>cm</option>
          <option value="in"${s.units==="in"?" selected":""}>in</option>
        </select>
      </label>
      <label style="display:flex; justify-content:space-between; gap:.75rem;">
        <span>Kerf</span>
        <input id="kerf" type="number" step="0.1" min="0" value="${s.kerf}" style="width:8rem;">
      </label>
      <label style="display:flex; justify-content:space-between; gap:.75rem;">
        <span>Margin</span>
        <input id="margin" type="number" step="0.1" min="0" value="${s.margin}" style="width:8rem;">
      </label>
    </div>
  `;

  const unitsEl = container.querySelector<HTMLSelectElement>("#units")!;
  const kerfEl = container.querySelector<HTMLInputElement>("#kerf")!;
  const marginEl = container.querySelector<HTMLInputElement>("#margin")!;

  const push = () =>
    setSettings({
      units: unitsEl.value as any,
      kerf: Number(kerfEl.value || 0),
      margin: Number(marginEl.value || 0),
    });

  unitsEl.addEventListener("change", push);
  kerfEl.addEventListener("input", push);
  marginEl.addEventListener("input", push);
}
