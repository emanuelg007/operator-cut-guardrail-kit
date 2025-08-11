export type State = Record<string, unknown>;

let state: State = {};

export function getState(): State {
  return state;
}

export function setState(next: Partial<State>): void {
  state = { ...state, ...next };
}
