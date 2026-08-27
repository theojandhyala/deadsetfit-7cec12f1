/**
 * Reflect an SVG path about a vertical axis.
 *
 * Muscle shapes come in pairs, and hand-writing the second one is how a bicep
 * ends up a different shape from its twin. Writing the left side and deriving
 * the right guarantees symmetry.
 *
 * Supports the subset the body shapes use: an absolute `M`, then relative
 * `l`, `h`, `v`, `q` and `z`. Anything else is rejected rather than silently
 * mangled — a wrong mirror is worse than a missing one, because it looks
 * plausible.
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
      if (!"MLHVQlhvq".includes(command)) {
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
        const x1 = take();
        const y1 = take();
        const x = take();
        const y = take();
        const flip = (value: number) => (command === "q" ? -value : axis * 2 - value);
        out.push(String(flip(x1)), String(y1), String(flip(x)), String(y));
        break;
      }
      default:
        throw new Error(`mirrorPath: value before any command in "${d}"`);
    }
  }

  return out.join(" ").replace(/\s+z/g, " z");
}
