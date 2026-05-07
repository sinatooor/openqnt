import SwiftUI
import Charts

struct EquityCurveChart: View {
    let points: [EquityPoint]

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Equity (30d)")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
            if points.isEmpty {
                Rectangle()
                    .fill(.thinMaterial)
                    .overlay(
                        Text("No history yet.").font(.caption).foregroundStyle(.secondary)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                Chart(points) { p in
                    AreaMark(
                        x: .value("Date", p.timestamp),
                        y: .value("Equity", p.equity)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.tint.opacity(0.5), .tint.opacity(0.05)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                    LineMark(
                        x: .value("Date", p.timestamp),
                        y: .value("Equity", p.equity)
                    )
                    .foregroundStyle(.tint)
                    .interpolationMethod(.catmullRom)
                }
                .chartXAxis(.hidden)
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 4))
                }
                .padding(.vertical, 4)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}
