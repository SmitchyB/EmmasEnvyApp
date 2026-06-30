export type PortfolioPhoto = {
  id: number;
  portfolio_id: number;
  url: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Portfolio = {
  id: number;
  employee_id: number | null;
  description: string | null;
  visible: boolean;
  name: string | null;
  portrait: string | null;
  created_at: string;
  updated_at: string;
  photos?: PortfolioPhoto[];
};
