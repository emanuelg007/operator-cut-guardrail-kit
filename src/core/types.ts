export interface PartRow {
  Name: string;
  MaterialCode: string;
  Thickness: number;
  Length: number;
  Width: number;
  Qty: number;
  Grain?: boolean;
  AllowRotate?: boolean;
  EdgeL1?: string;
  EdgeL2?: string;
  EdgeW1?: string;
  EdgeW2?: string;
  Notes1?: string;
  Notes2?: string;
}

export interface MaterialBoard {
  Id: string;
  Name: string;
  BoardLength: number;
  BoardWidth: number;
  Thickness: number;
  Grain: boolean;
  AllowRotation: boolean;
  KerfOverride?: number;
  CostPerSheet?: number;
  StockQty?: number;
  SKU?: string;
}
