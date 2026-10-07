export type Role = 'owner' | 'manager' | 'rep' | 'storekeeper' | 'accountant';

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'مالك الشركة',
  manager: 'مدير',
  rep: 'مندوب مبيعات',
  storekeeper: 'أمين مخزن',
  accountant: 'محاسب',
};

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
  /** ربط حساب المستخدم بسجل المندوب (للمندوبين فقط) */
  repId?: string;
}

export type CurrencyCode = 'SAR' | 'AED' | 'EGP' | 'IQD' | 'YER' | 'JOD' | 'KWD' | 'QAR' | 'OMR' | 'BHD' | 'USD';

export interface Company {
  id: string;
  name: string;
  phone?: string;
  currency: CurrencyCode;
  /** مفتاح الدولة للواتساب بدون + (مثال: 966) */
  dialCode: string;
  defaultCreditDays: number;
  ownerUid: string;
  createdAt: number;
}

export type PriceList = 'wholesale' | 'semi' | 'retail';
export const PRICE_LIST_LABELS: Record<PriceList, string> = {
  wholesale: 'جملة',
  semi: 'نصف جملة',
  retail: 'مفرد',
};

export interface Zone {
  id: string;
  name: string;
  color: string;
}

export interface Rep {
  id: string;
  name: string;
  phone: string;
  zoneIds: string[];
  salesTarget: number;
  collectionTarget: number;
  active: boolean;
  color: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  zoneId: string;
  repId: string;
  priceList: PriceList;
  creditLimit: number;
  creditDays: number;
  /** الرصيد المستحق على العميل (موجب = دين) */
  balance: number;
  active: boolean;
  createdAt: number;
  lastOrderAt?: number;
  lastVisitAt?: number;
  promiseDate?: number;
  promiseAmount?: number;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  emoji: string;
  cost: number;
  prices: Record<PriceList, number>;
  minStock: number;
  active: boolean;
}

export type WarehouseType = 'main' | 'branch' | 'van';
export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  main: 'مخزن رئيسي',
  branch: 'مخزن فرعي',
  van: 'مخزن سيارة',
};

export interface Warehouse {
  id: string;
  name: string;
  type: WarehouseType;
  repId?: string;
}

export interface StockItem {
  /** `${warehouseId}_${productId}` */
  id: string;
  warehouseId: string;
  productId: string;
  qty: number;
}

export type MovementType = 'sale' | 'cancel' | 'receive' | 'transfer_in' | 'transfer_out' | 'adjust' | 'return';
export const MOVEMENT_LABELS: Record<MovementType, string> = {
  sale: 'بيع',
  cancel: 'إلغاء طلب',
  receive: 'استلام بضاعة',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  adjust: 'تسوية جرد',
  return: 'مرتجع',
};

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  qty: number;
  type: MovementType;
  refId?: string;
  note?: string;
  byName: string;
  createdAt: number;
}

export type OrderStatus = 'credit_hold' | 'new' | 'approved' | 'preparing' | 'delivered' | 'cancelled';
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  credit_hold: 'بانتظار موافقة الائتمان',
  new: 'جديد',
  approved: 'معتمد',
  preparing: 'قيد التجهيز',
  delivered: 'مسلَّم',
  cancelled: 'ملغي',
};
export const ORDER_FLOW: OrderStatus[] = ['new', 'approved', 'preparing', 'delivered'];

export interface OrderItem {
  productId: string;
  name: string;
  emoji: string;
  unit: string;
  qty: number;
  freeQty: number;
  price: number;
  discount: number;
  lineTotal: number;
  offerId?: string;
  offerName?: string;
}

export interface Order {
  id: string;
  no: string;
  customerId: string;
  customerName: string;
  repId: string;
  repName: string;
  zoneId: string;
  warehouseId: string;
  items: OrderItem[];
  subtotal: number;
  lineDiscount: number;
  orderDiscount: number;
  orderOfferName?: string;
  total: number;
  paymentType: 'cash' | 'credit';
  paidNow: number;
  dueAt: number;
  status: OrderStatus;
  note?: string;
  createdAt: number;
  updatedAt: number;
  createdByName: string;
  deliveredAt?: number;
  cancelReason?: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'cheque';
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدًا',
  transfer: 'تحويل بنكي',
  cheque: 'شيك',
};

export interface Collection {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  repId: string;
  repName: string;
  zoneId: string;
  /** مرتبط بطلب (دفعة وقت الطلب) وإلا سند قبض عام */
  orderId?: string;
  status: 'active' | 'void';
  reference?: string;
  note?: string;
  createdAt: number;
  byName: string;
}

export type OfferType = 'percent' | 'bxgy' | 'order_percent';
export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  percent: 'خصم نسبة على صنف',
  bxgy: 'اشترِ واحصل على مجانًا',
  order_percent: 'خصم على إجمالي الفاتورة',
};

export interface Offer {
  id: string;
  name: string;
  type: OfferType;
  /** نطاق الصنف: منتجات محددة أو فئة كاملة (للأنواع percent و bxgy) */
  productIds: string[];
  category: string;
  minQty: number;
  percent: number;
  buyQty: number;
  freeQty: number;
  minTotal: number;
  startAt: number;
  endAt: number;
  active: boolean;
}

export type VisitResult = 'order' | 'collected' | 'no_order' | 'closed';
export const VISIT_RESULT_LABELS: Record<VisitResult, string> = {
  order: 'تم أخذ طلب',
  collected: 'تم التحصيل',
  no_order: 'بدون طلب',
  closed: 'المحل مغلق',
};

export interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  repId: string;
  repName: string;
  zoneId: string;
  result: VisitResult;
  note?: string;
  lat?: number;
  lng?: number;
  createdAt: number;
}

export interface Invite {
  email: string;
  companyId: string;
  role: Role;
  name: string;
  repId?: string;
  createdAt: number;
}

/** أسماء المجموعات الفرعية داخل الشركة */
export interface CollectionMap {
  customers: Customer;
  products: Product;
  warehouses: Warehouse;
  stock: StockItem;
  stockMovements: StockMovement;
  orders: Order;
  collections: Collection;
  reps: Rep;
  zones: Zone;
  offers: Offer;
  visits: Visit;
}
export type CollName = keyof CollectionMap;

export const CURRENCIES: Record<CurrencyCode, { label: string; symbol: string; decimals: number; dial: string }> = {
  SAR: { label: 'ريال سعودي', symbol: 'ر.س', decimals: 2, dial: '966' },
  AED: { label: 'درهم إماراتي', symbol: 'د.إ', decimals: 2, dial: '971' },
  EGP: { label: 'جنيه مصري', symbol: 'ج.م', decimals: 2, dial: '20' },
  IQD: { label: 'دينار عراقي', symbol: 'د.ع', decimals: 0, dial: '964' },
  YER: { label: 'ريال يمني', symbol: 'ر.ي', decimals: 0, dial: '967' },
  JOD: { label: 'دينار أردني', symbol: 'د.أ', decimals: 2, dial: '962' },
  KWD: { label: 'دينار كويتي', symbol: 'د.ك', decimals: 3, dial: '965' },
  QAR: { label: 'ريال قطري', symbol: 'ر.ق', decimals: 2, dial: '974' },
  OMR: { label: 'ريال عماني', symbol: 'ر.ع', decimals: 3, dial: '968' },
  BHD: { label: 'دينار بحريني', symbol: 'د.ب', decimals: 3, dial: '973' },
  USD: { label: 'دولار أمريكي', symbol: '$', decimals: 2, dial: '1' },
};
