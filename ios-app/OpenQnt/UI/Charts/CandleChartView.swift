import SwiftUI
import Charts

/// Native candle chart using Swift Charts (iOS 16+).
struct CandleChartView: View {
    let candles: [Candle]

    var body: some View {
        if candles.isEmpty {
            Rectangle()
                .fill(.thinMaterial)
                .overlay(Text("No data").foregroundStyle(.secondary))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
            Chart(candles) { c in
                // Wick
                RuleMark(
                    x: .value("Time", c.timestamp),
                    yStart: .value("Low", c.low),
                    yEnd: .value("High", c.high)
                )
                .foregroundStyle(c.close >= c.open ? .green : .red)

                // Body — use BarMark with a vertical range
                BarMark(
                    x: .value("Time", c.timestamp),
                    yStart: .value("Body low", min(c.open, c.close)),
                    yEnd: .value("Body high", max(c.open, c.close)),
                    width: .fixed(4)
                )
                .foregroundStyle(c.close >= c.open ? .green : .red)
            }
            .chartYAxis {
                AxisMarks(position: .trailing, values: .automatic(desiredCount: 4))
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) { value in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.month().day())
                }
            }
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
