import { Fragment } from "react";

export const NBSP = "\u00a0";

interface Props {
  obj?: object;
  entries?: Array<[string, any] | undefined>;
}

export function ObjectGrid({ obj = {}, entries }: Props) {
  entries ??= Object.entries(obj);
  return (
    <div className="grid" style={{ gridTemplateColumns: "auto 1fr", overflowWrap: "anywhere" }}>
      {entries.map((entry, i) => (
        <Fragment key={i}>
          {entry ? (
            <>
              <p>
                <strong>{pad(entry[0])}:</strong>&nbsp;
              </p>
              <p>{stringify(entry[1])}</p>
            </>
          ) : (
            <>
              <div className="mt-2"></div>
              <div className="mt-2"></div>
            </>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function pad(str: string): string {
  const m = str.match(/(^\s+)/);
  const n = m ? m[0].length : 0;
  return NBSP.repeat(n) + str.slice(n);
}

function stringify(val: any): string {
  switch (typeof val) {
    case "string":
      return val;
    case "undefined":
      return "---";
    default:
      return JSON.stringify(val);
  }
}
