export function RawDataPreview() {
  const rows = [["time_s", "baro_alt", "vel", "note"], ["0", "0", "0", "pad"], ["1", "88", "54", "boost"], ["2", "214", "76", "coast"]];
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, i) => <tr key={i} className="border-b border-white/10 last:border-0">{row.map((cell) => <td key={cell} className="px-3 py-2 text-orange-50/72">{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
