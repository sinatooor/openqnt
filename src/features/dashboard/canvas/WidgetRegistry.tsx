import { ComponentType } from 'react';
import PortfolioSummaryWidget from '../widgets/PortfolioSummaryWidget';
import MarketSentimentWidget from '../widgets/MarketSentimentWidget';
import NewsFeedWidget from '../widgets/NewsFeedWidget';
import EconomicCalendarWidget from '../widgets/EconomicCalendarWidget';
import WatchlistWidget from '../widgets/WatchlistWidget';
import TopMoversWidget from '../widgets/TopMoversWidget';
import IndicesWidget from '../widgets/IndicesWidget';
import SectorHeatmapWidget from '../widgets/SectorHeatmapWidget';
import AgentActivityWidget from '../widgets/AgentActivityWidget';

export interface WidgetDefinition {
  name: string;
  description: string;
  Component: ComponentType;
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'portfolio-summary': {
    name: 'Portfolio Summary',
    description: 'High-level metrics of your accounts and total equity',
    Component: PortfolioSummaryWidget,
  },
  'market-sentiment': {
    name: 'Market Sentiment',
    description: 'Fear & Greed index and NLP sentiment overview',
    Component: MarketSentimentWidget,
  },
  'news-feed': {
    name: 'News Feed',
    description: 'Latest financial news and major events',
    Component: NewsFeedWidget,
  },
  'economic-calendar': {
    name: 'Economic Calendar',
    description: 'Upcoming macroeconomic events and earnings',
    Component: EconomicCalendarWidget,
  },
  watchlist: {
    name: 'Watchlist',
    description: 'Monitor your favorite tickers in real time',
    Component: WatchlistWidget,
  },
  'top-movers': {
    name: 'Top Movers',
    description: 'Biggest gainers and losers in the market today',
    Component: TopMoversWidget,
  },
  indices: {
    name: 'World Indices',
    description: 'Major global index tape with live net and percentage change',
    Component: IndicesWidget,
  },
  'sector-heatmap': {
    name: 'DJ30 Heatmap',
    description: 'Dow Jones 30 treemap weighted by market cap',
    Component: SectorHeatmapWidget,
  },
  'agent-activity': {
    name: 'Agent Activity',
    description: 'Live feed of recent Boss runs — task, status, signal, confidence',
    Component: AgentActivityWidget,
  },
};

export const availableWidgetTypes = Object.keys(widgetRegistry);
