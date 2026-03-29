import { ReactNode } from 'react';
import PortfolioSummaryWidget from '../widgets/PortfolioSummaryWidget';
import MarketSentimentWidget from '../widgets/MarketSentimentWidget';
import NewsFeedWidget from '../widgets/NewsFeedWidget';
import EconomicCalendarWidget from '../widgets/EconomicCalendarWidget';
import WatchlistWidget from '../widgets/WatchlistWidget';
import TopMoversWidget from '../widgets/TopMoversWidget';
import IndicesWidget from '../widgets/IndicesWidget';
import SectorHeatmapWidget from '../widgets/SectorHeatmapWidget';

export interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  component: ReactNode;
}

export const widgetRegistry: Record<string, Omit<WidgetDefinition, 'type'>> = {
  'portfolio-summary': {
    name: 'Portfolio Summary',
    description: 'High-level metrics of your accounts and total equity',
    component: <PortfolioSummaryWidget />,
  },
  'market-sentiment': {
    name: 'Market Sentiment',
    description: 'Fear & Greed index and NLP sentiment overview',
    component: <MarketSentimentWidget />,
  },
  'news-feed': {
    name: 'News Feed',
    description: 'Latest financial news and major events',
    component: <NewsFeedWidget />,
  },
  'economic-calendar': {
    name: 'Economic Calendar',
    description: 'Upcoming macroeconomic events and earnings',
    component: <EconomicCalendarWidget />,
  },
  'watchlist': {
    name: 'Watchlist',
    description: 'Monitor your favorite tickers in real time',
    component: <WatchlistWidget />,
  },
  'top-movers': {
    name: 'Top Movers',
    description: 'Biggest gainers and losers in the market today',
    component: <TopMoversWidget />,
  },
  indices: {
    name: 'World Indices',
    description: 'Major global index tape with live net and percentage change',
    component: <IndicesWidget />,
  },
  'sector-heatmap': {
    name: 'Sector Heatmap',
    description: 'S&P sector breadth heatmap similar to a terminal mosaic',
    component: <SectorHeatmapWidget />,
  },
};

export const availableWidgetTypes = Object.keys(widgetRegistry);
