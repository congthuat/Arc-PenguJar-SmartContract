export const PAY_SERVICE_IDS = ["mobile", "data", "electricity", "water", "internet", "television", "movies", "games", "giftCards", "shopping", "food", "transport", "travel", "hotels", "education", "otherBills", "merchant", "subscriptions"] as const;
export type PayServiceId = (typeof PAY_SERVICE_IDS)[number];

export const POPULAR_PAY_SERVICE_IDS: readonly PayServiceId[] = ["mobile", "electricity", "internet", "movies", "giftCards", "merchant"];
export const HOME_PAY_SERVICE_IDS: readonly PayServiceId[] = ["mobile", "data", "electricity", "water", "internet", "movies", "giftCards", "merchant"];

export const PAY_SERVICE_ART: Record<PayServiceId, string> = {
  mobile: "/makoto/pay/mobile-topup.svg", data: "/makoto/pay/data.svg", electricity: "/makoto/pay/electricity.svg", water: "/makoto/pay/water.svg", internet: "/makoto/pay/internet.svg", television: "/makoto/pay/television.svg", movies: "/makoto/pay/movies.svg", games: "/makoto/pay/games.svg", giftCards: "/makoto/pay/gift-card.svg", shopping: "/makoto/pay/shopping.svg", food: "/makoto/pay/food.svg", transport: "/makoto/pay/transport.svg", travel: "/makoto/pay/travel.svg", hotels: "/makoto/pay/hotel.svg", education: "/makoto/pay/education.svg", otherBills: "/makoto/pay/bills.svg", merchant: "/makoto/pay/merchant-pay.svg", subscriptions: "/makoto/pay/subscriptions.svg",
};
