
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { JournalModal } from "./JournalModal";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the trades service
vi.mock("@/services/trades", () => ({
    fetchTrades: vi.fn().mockResolvedValue([
        {
            id: 1,
            execution_id: 101,
            symbol: "EURUSD",
            direction: "BUY",
            entry_time: "2024-01-01T10:00:00Z",
            entry_price: 1.0850,
            size: 100000,
            exit_time: "2024-01-01T12:00:00Z",
            exit_price: 1.0900,
            pnl: 500,
            pnl_percent: 0.46,
            status: "CLOSED",
            broker_ref: "deal_123"
        }
    ]),
    fetchTradeSummary: vi.fn().mockResolvedValue({
        total_trades: 1,
        win_rate: 1.0,
        total_pnl: 500
    })
}));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const renderJournalModal = (isOpen: boolean = true) => {
    return render(
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <JournalModal isOpen={isOpen} onClose={vi.fn()} />
            </BrowserRouter>
        </QueryClientProvider>
    );
};

describe("JournalModal", () => {
    beforeEach(() => {
        queryClient.clear();
    });

    it("renders the journal title when open", async () => {
        renderJournalModal(true);
        expect(screen.getByText("Trade Journal")).toBeDefined();
    });

    it("does not render when closed", async () => {
        renderJournalModal(false);
        expect(screen.queryByText("Trade Journal")).toBeNull();
    });

    it("displays trade data in the table", async () => {
        renderJournalModal(true);
        // Use findByText to wait for the mocked data to load
        const symbol = await screen.findByText("EURUSD");
        expect(symbol).toBeDefined();
        expect(screen.getByText("BUY")).toBeDefined();
        expect(screen.getByText("+500.00")).toBeDefined();
    });

    it("displays summary statistics", async () => {
        renderJournalModal(true);
        const totalPnl = await screen.findByText("$500.00");
        expect(totalPnl).toBeDefined();
        expect(screen.getByText("100.0%")).toBeDefined(); // Win Rate
    });
});
