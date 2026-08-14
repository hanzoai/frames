// The v1 provider surface. The ordered, capability-based registry lives in
// registry.mjs; this names the two functions a caller needs to ask "what serves
// this type?" without reaching into the cascade.
export { getProvider, listTypes } from "./registry.mjs";
