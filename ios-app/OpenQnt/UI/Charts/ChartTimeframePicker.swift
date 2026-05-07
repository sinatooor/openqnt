import SwiftUI

struct ChartTimeframePicker: View {
    @Binding var selected: ChartTimeframe

    var body: some View {
        HStack(spacing: 6) {
            ForEach(ChartTimeframe.allCases) { tf in
                Button {
                    selected = tf
                } label: {
                    Text(tf.label)
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            tf == selected
                                ? AnyShapeStyle(Color.accentColor.opacity(0.25))
                                : AnyShapeStyle(.thinMaterial),
                            in: Capsule()
                        )
                        .foregroundStyle(tf == selected ? Color.accentColor : .primary)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
