/**
 * Reflect an SVG path about a vertical axis.
 *
 * Muscle shapes come in pairs, and hand-writing the second one is how a bicep
 * ends up a different shape from its twin. Writing the left side and deriving
 * the right guarantees symmetry.
 *
 * Supports the subset the body shapes use: `M`, `L`, `H`, `V`, `Q`, `C` and
 * `z`, in absolute or relative form. Anything else — an elliptical arc above
 * all, whose radii and sweep flag do not reflect by negating a number — is
 * rejected rather than silently mangled. A wrong mirror is worse than a
 * missing one, because it looks plausible.
 */
const AXIS = 100;

export function mirrorPath(d: string, axis = AXIS): string {
  // Every command letter, not just the supported ones — an unsupported command
  // must be recognised and rejected by name, not fall through and be consumed
  // as arguments to the previous one.
  const tokens = d.trim().match(/[A-Za-z]|-?\d+(?:\.\d+)?/g);
  if (!tokens) return d;

  const out: string[] = [];
  let index = 0;
  let command = "";

  const take = () => {
    const value = Number(tokens[index++]);
    if (!Number.isFinite(value)) throw new Error(`mirrorPath: bad number in "${d}"`);
    return value;
  };

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (/[A-Za-z]/.test(token)) {
      command = token;
      index += 1;
      if (command === "z" || command === "Z") {
        out.push("z");
        continue;
      }
      if (!"MLHVQClhvqc".includes(command)) {
        throw new Error(`mirrorPath: unsupported command "${command}" in "${d}"`);
      }
      out.push(command);
      continue;
    }

    switch (command) {
      case "M": {
        const x = take();
        const y = take();
        out.push(String(axis * 2 - x), String(y));
        break;
      }
      case "l":
      case "L": {
        // Relative: negate the horizontal delta. Absolute L is not used by the
        // body shapes, and reflecting it would need the axis anyway.
        const dx = take();
        const dy = take();
        out.push(String(command === "l" ? -dx : axis * 2 - dx), String(dy));
        break;
      }
      case "h":
      case "H": {
        const dx = take();
        out.push(String(command === "h" ? -dx : axis * 2 - dx));
        break;
      }
      case "v":
      case "V": {
        out.push(String(take()));
        break;
      }
      case "q":
      case "Q": {
        const flip = (value: number) => (command === "q" ? -value : axis * 2 - value);
        const x1 = take();
        const y1 = take();
        const x = take();
        const y = take();
        out.push(String(flip(x1)), String(y1), String(flip(x)), String(y));
        break;
      }
      case "c":
      case "C": {
        // Both control points and the endpoint reflect the same way, so a
        // cubic mirrors exactly — which is why the anatomy is drawn in cubics.
        const flip = (value: number) => (command === "c" ? -value : axis * 2 - value);
        const values: number[] = [];
        for (let i = 0; i < 6; i += 1) values.push(take());
        for (let i = 0; i < 6; i += 2) out.push(String(flip(values[i]!)), String(values[i + 1]!));
        break;
      }
      default:
        throw new Error(`mirrorPath: value before any command in "${d}"`);
    }
  }

  return out.join(" ").replace(/\s+z/g, " z");
}
