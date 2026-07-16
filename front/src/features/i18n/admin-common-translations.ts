"use client";

import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";

const english = {
  common: {
    active: "Active",
    admin: "Admin",
    inactive: "Inactive",
    next: "Next",
    notAvailable: "Not available",
    notSet: "Not set",
    previous: "Previous",
    refresh: "Refresh",
    request: "Request",
    retry: "Retry",
    unavailable: "Unavailable",
    unknown: "Unknown",
  },
  shell: {
    adminHomeLabel: "Belikeme admin home",
    language: "Language",
    managementConsole: "Management Console",
    signOut: "Sign out",
    storefront: "Storefront",
  },
  navigation: {
    categories: "Categories",
    chats: "Chats",
    dashboard: "Dashboard",
    gallery: "Landing Gallery",
    label: "Admin navigation",
    orders: "Orders",
    products: "Products",
    returns: "Returns",
    users: "Users",
    vouchers: "Vouchers",
  },
  guard: {
    accessRequired: "Admin access required",
    backToShop: "Back to shop",
    checkingAccess: "Checking admin access",
    checkingMessage: "Waiting for your session before opening the admin workspace.",
    eyebrow: "Belikeme admin",
    forbiddenMessage: "This account does not have permission to open the admin workspace.",
    home: "Home",
    signIn: "Sign in",
    signInMessage: "Sign in with an admin account to continue.",
    signInRequired: "Admin sign-in required",
    signedInRole: "Signed in role",
  },
  modal: {
    close: "Close modal",
    discardChanges: "Discard your unsaved changes?",
  },
  commerce: {
    paymentSafety:
      "Paid state is finalized only by a verified payOS webhook. Admin diagnostics are read-only for payment state.",
    paymentSafetyTransition: "Cancel or expire does not call the payOS provider.",
  },
  dashboard: {
    allCustomers: "All registered customer accounts",
    apply: "Apply",
    averageOrderDescription: "Across verified paid orders",
    averageOrderValue: "Average order value",
    cancelled: "Cancelled",
    chartDescription:
      "Bar chart of verified paid revenue for each API-provided monthly bucket in the selected range.",
    chartTitle: "Monthly verified paid revenue",
    chooseBothDates: "Choose both a from and to date.",
    currentTotals: "Current API totals for the selected range",
    currentYear: "Current year",
    customers: "Customers",
    dataUnavailable: "Dashboard data could not be loaded.",
    dateFilters: "Dashboard date filters",
    dateOrderError: "The from date must be before or equal to the to date.",
    expired: "Expired",
    from: "From",
    kpiLabel: "Key performance indicators",
    last12Months: "Last 12 months",
    last30Days: "Last 30 days",
    last90Days: "Last 90 days",
    loadingMonthlySales: "Loading monthly sales",
    loadingTopProducts: "Loading top products",
    lowStockVariants: "Low-stock variants",
    monthlySales: "Monthly sales",
    monthlySalesDescription: "Verified paid revenue in the selected range",
    noPaidProductSales: "No paid product sales yet",
    noSales: "No sales data yet",
    noSalesDescription:
      "Verified paid revenue will appear here when it is available for this date range.",
    operationalOverview: "Operational overview",
    operations: "Operations",
    paid: "Paid",
    paidOrders: "Paid orders",
    paidRevenue: "Paid revenue",
    paidSales: "Paid sales",
    partialUnavailable: "Some dashboard data is temporarily unavailable.",
    pendingPayment: "Pending payment",
    performance: "Performance",
    range: "Range",
    refreshLabel: "Refresh dashboard data",
    storeOperations: "Store operations",
    storeStatus: "Store status",
    subtitle: "Live catalog, customer, order, and verified revenue signals.",
    title: "Dashboard Overview",
    to: "To",
    topProducts: "Top Products",
    topProductsUnavailable: "Top products are temporarily unavailable.",
    totalProducts: "Total products",
    totalRevenue: "Total revenue",
    uncategorized: "Uncategorized",
    verifiedRevenueOnly: "Verified paid revenue only",
    viewAll: "View All",
  },
  statsErrors: {
    apiUnavailable: "The dashboard API could not be reached. Check the backend and retry.",
    authRequired: "Your admin session is required. Sign in again to continue.",
    badRequest: "Some dashboard filters are invalid. Review the date range and try again.",
    forbidden: "This account is not allowed to view admin analytics.",
    generic: "Dashboard data could not be loaded right now.",
    network: "The dashboard API could not be reached. Check the backend and retry.",
    rangeTooLarge: "The selected date range is too large.",
  },
  roles: {
    ADMIN: "Administrator",
    CUSTOMER: "Customer",
    STAFF: "Staff",
  },
};

export type AdminCommonMessages = typeof english;

const vietnamese: AdminCommonMessages = {
  common: {
    active: "Đang hoạt động",
    admin: "Quản trị viên",
    inactive: "Ngừng hoạt động",
    next: "Tiếp theo",
    notAvailable: "Không khả dụng",
    notSet: "Chưa thiết lập",
    previous: "Trước",
    refresh: "Làm mới",
    request: "Yêu cầu",
    retry: "Thử lại",
    unavailable: "Không khả dụng",
    unknown: "Không xác định",
  },
  shell: {
    adminHomeLabel: "Trang chủ quản trị Belikeme",
    language: "Ngôn ngữ",
    managementConsole: "Bảng quản trị",
    signOut: "Đăng xuất",
    storefront: "Cửa hàng",
  },
  navigation: {
    categories: "Danh mục",
    chats: "Trò chuyện",
    dashboard: "Tổng quan",
    gallery: "Thư viện trang chủ",
    label: "Điều hướng quản trị",
    orders: "Đơn hàng",
    products: "Sản phẩm",
    returns: "Trả hàng",
    users: "Người dùng",
    vouchers: "Mã giảm giá",
  },
  guard: {
    accessRequired: "Yêu cầu quyền quản trị",
    backToShop: "Quay lại cửa hàng",
    checkingAccess: "Đang kiểm tra quyền quản trị",
    checkingMessage: "Đang kiểm tra phiên đăng nhập trước khi mở khu vực quản trị.",
    eyebrow: "Quản trị Belikeme",
    forbiddenMessage: "Tài khoản này không có quyền truy cập khu vực quản trị.",
    home: "Trang chủ",
    signIn: "Đăng nhập",
    signInMessage: "Đăng nhập bằng tài khoản quản trị viên để tiếp tục.",
    signInRequired: "Cần đăng nhập quản trị",
    signedInRole: "Vai trò hiện tại",
  },
  modal: {
    close: "Đóng hộp thoại",
    discardChanges: "Bỏ các thay đổi chưa lưu?",
  },
  commerce: {
    paymentSafety:
      "Trạng thái đã thanh toán chỉ được xác nhận bởi webhook payOS đã xác thực. Công cụ chẩn đoán quản trị chỉ đọc trạng thái thanh toán.",
    paymentSafetyTransition: "Hủy hoặc cho hết hạn không gọi nhà cung cấp payOS.",
  },
  dashboard: {
    allCustomers: "Tất cả tài khoản khách hàng đã đăng ký",
    apply: "Áp dụng",
    averageOrderDescription: "Tính trên các đơn đã thanh toán và xác minh",
    averageOrderValue: "Giá trị đơn hàng trung bình",
    cancelled: "Đã hủy",
    chartDescription:
      "Biểu đồ cột thể hiện doanh thu đã thanh toán và xác minh theo từng tháng do API cung cấp trong khoảng thời gian đã chọn.",
    chartTitle: "Doanh thu đã thanh toán và xác minh theo tháng",
    chooseBothDates: "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.",
    currentTotals: "Tổng số liệu API hiện tại trong khoảng thời gian đã chọn",
    currentYear: "Năm hiện tại",
    customers: "Khách hàng",
    dataUnavailable: "Không thể tải dữ liệu bảng điều khiển.",
    dateFilters: "Bộ lọc ngày của bảng điều khiển",
    dateOrderError: "Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.",
    expired: "Hết hạn",
    from: "Từ ngày",
    kpiLabel: "Các chỉ số hiệu suất chính",
    last12Months: "12 tháng gần nhất",
    last30Days: "30 ngày gần nhất",
    last90Days: "90 ngày gần nhất",
    loadingMonthlySales: "Đang tải doanh thu theo tháng",
    loadingTopProducts: "Đang tải sản phẩm bán chạy",
    lowStockVariants: "Biến thể sắp hết hàng",
    monthlySales: "Doanh thu theo tháng",
    monthlySalesDescription: "Doanh thu đã thanh toán và xác minh trong khoảng thời gian đã chọn",
    noPaidProductSales: "Chưa có sản phẩm nào phát sinh doanh số đã thanh toán",
    noSales: "Chưa có dữ liệu doanh thu",
    noSalesDescription:
      "Doanh thu đã thanh toán và xác minh sẽ xuất hiện tại đây khi có dữ liệu trong khoảng thời gian này.",
    operationalOverview: "Tổng quan vận hành",
    operations: "Vận hành",
    paid: "Đã thanh toán",
    paidOrders: "Đơn đã thanh toán",
    paidRevenue: "Doanh thu đã thanh toán",
    paidSales: "Doanh số đã thanh toán",
    partialUnavailable: "Một phần dữ liệu bảng điều khiển đang tạm thời không khả dụng.",
    pendingPayment: "Chờ thanh toán",
    performance: "Hiệu suất",
    range: "Khoảng thời gian",
    refreshLabel: "Làm mới dữ liệu bảng điều khiển",
    storeOperations: "Vận hành cửa hàng",
    storeStatus: "Trạng thái cửa hàng",
    subtitle: "Dữ liệu trực tiếp về danh mục, khách hàng, đơn hàng và doanh thu đã xác minh.",
    title: "Tổng quan bảng điều khiển",
    to: "Đến ngày",
    topProducts: "Sản phẩm bán chạy",
    topProductsUnavailable: "Dữ liệu sản phẩm bán chạy đang tạm thời không khả dụng.",
    totalProducts: "Tổng sản phẩm",
    totalRevenue: "Tổng doanh thu",
    uncategorized: "Chưa phân loại",
    verifiedRevenueOnly: "Chỉ tính doanh thu đã thanh toán và xác minh",
    viewAll: "Xem tất cả",
  },
  statsErrors: {
    apiUnavailable: "Không thể kết nối API bảng điều khiển. Hãy kiểm tra backend và thử lại.",
    authRequired: "Cần phiên quản trị hợp lệ. Vui lòng đăng nhập lại để tiếp tục.",
    badRequest: "Một số bộ lọc bảng điều khiển không hợp lệ. Hãy kiểm tra khoảng ngày và thử lại.",
    forbidden: "Tài khoản này không có quyền xem số liệu quản trị.",
    generic: "Hiện không thể tải dữ liệu bảng điều khiển.",
    network: "Không thể kết nối API bảng điều khiển. Hãy kiểm tra backend và thử lại.",
    rangeTooLarge: "Khoảng thời gian đã chọn quá dài.",
  },
  roles: {
    ADMIN: "Quản trị viên",
    CUSTOMER: "Khách hàng",
    STAFF: "Nhân viên",
  },
};

const ADMIN_COMMON_TRANSLATIONS: Record<Locale, AdminCommonMessages> = {
  en: english,
  vi: vietnamese,
};

export function useAdminCommonI18n() {
  const { locale, setLocale } = useI18n();

  return {
    locale,
    messages: ADMIN_COMMON_TRANSLATIONS[locale],
    setLocale,
  };
}

export function getAdminCommonMessages(locale: Locale): AdminCommonMessages {
  return ADMIN_COMMON_TRANSLATIONS[locale];
}

export function getIntlLocale(locale: Locale): "en-US" | "vi-VN" {
  return locale === "vi" ? "vi-VN" : "en-US";
}

export function formatAdminNotificationLabel(
  locale: Locale,
  label: string,
  count: number,
): string {
  const formattedCount = new Intl.NumberFormat(getIntlLocale(locale)).format(count);

  return locale === "vi"
    ? `${label}, ${formattedCount} thông báo mới`
    : `${label}, ${formattedCount} new`;
}

export function formatAdminNotificationTitle(
  locale: Locale,
  label: string,
  count: number,
): string {
  const formattedCount = new Intl.NumberFormat(getIntlLocale(locale)).format(count);

  return locale === "vi"
    ? `${formattedCount} thông báo mới trong ${label}`
    : `${formattedCount} new ${label}`;
}

export function formatAdminPaginationSummary(
  locale: Locale,
  page: number,
  totalPages: number,
  total: number,
  noun: string,
): string {
  const formatter = new Intl.NumberFormat(getIntlLocale(locale));

  return locale === "vi"
    ? `Trang ${formatter.format(page)} / ${formatter.format(totalPages)} (${formatter.format(total)} ${noun})`
    : `Page ${formatter.format(page)} of ${formatter.format(totalPages)} (${formatter.format(total)} ${noun})`;
}

export function formatAdminPaginationLabel(locale: Locale, noun: string): string {
  return locale === "vi" ? `Phân trang ${noun}` : `${noun} pagination`;
}

export function formatAdminLoadingLabel(locale: Locale, label: string): string {
  return locale === "vi" ? `Đang tải: ${label}` : `Loading ${label}`;
}

export function formatAdminSoldCount(locale: Locale, count: number): string {
  const formattedCount = new Intl.NumberFormat(getIntlLocale(locale)).format(count);

  return locale === "vi" ? `Đã bán ${formattedCount}` : `${formattedCount} sold`;
}
