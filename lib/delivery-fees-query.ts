export interface DeliveryFeesPayload {
  fees: Array<{
    state: string;
    stateCode: string;
    fee: number;
  }>;
  isFreeDeliveryActive: boolean;
}

export const parseDeliveryFeesResponse = (data: unknown): DeliveryFeesPayload => {
  if (Array.isArray(data)) {
    return {
      fees: data,
      isFreeDeliveryActive: false,
    };
  }

  if (data && typeof data === "object" && Array.isArray((data as DeliveryFeesPayload).fees)) {
    const payload = data as DeliveryFeesPayload;
    return {
      fees: payload.fees,
      isFreeDeliveryActive: payload.isFreeDeliveryActive === true,
    };
  }

  return {
    fees: [],
    isFreeDeliveryActive: false,
  };
};
