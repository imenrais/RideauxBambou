import { DeliveryFee } from "@prisma/client";

import { prisma } from "./prisma";

let cachedDeliveryFees: DeliveryFee[] | null = null;

const GOVERNORATES: Array<{ state: string; stateCode: string }> = [
  { state: "Ariana", stateCode: "AR" },
  { state: "Béja", stateCode: "BJ" },
  { state: "Ben Arous", stateCode: "BA" },
  { state: "Bizerte", stateCode: "BI" },
  { state: "Gabès", stateCode: "GB" },
  { state: "Gafsa", stateCode: "GF" },
  { state: "Jendouba", stateCode: "JE" },
  { state: "Kairouan", stateCode: "KR" },
  { state: "Kasserine", stateCode: "KS" },
  { state: "Kébili", stateCode: "KB" },
  { state: "Kef", stateCode: "KF" },
  { state: "Mahdia", stateCode: "MH" },
  { state: "Manouba", stateCode: "MN" },
  { state: "Médenine", stateCode: "ME" },
  { state: "Monastir", stateCode: "MO" },
  { state: "Nabeul", stateCode: "NB" },
  { state: "Sfax", stateCode: "SF" },
  { state: "Sidi Bouzid", stateCode: "SB" },
  { state: "Siliana", stateCode: "SL" },
  { state: "Sousse", stateCode: "SO" },
  { state: "Tataouine", stateCode: "TT" },
  { state: "Tozeur", stateCode: "TO" },
  { state: "Tunis", stateCode: "TU" },
  { state: "Zaghouan", stateCode: "ZA" },
];

const normalizeGovernorate = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const resolveStateInfo = (stateOrCode: string) => {
  const normalized = normalizeGovernorate(stateOrCode);
  const upperRaw = stateOrCode.trim().toUpperCase();

  const exactByCode = GOVERNORATES.find((g) => g.stateCode === upperRaw);
  if (exactByCode) {
    return exactByCode;
  }

  const exactByName = GOVERNORATES.find((g) => normalizeGovernorate(g.state) === normalized);
  if (exactByName) {
    return exactByName;
  }

  return {
    state: stateOrCode,
    stateCode: upperRaw.slice(0, 2),
  };
};

export async function initializeDeliveryFees() {
  const fees = await initializeStates(11, "system");
  cachedDeliveryFees = fees;
  console.log("Delivery fees initialized for all Tunisian states");
}

export async function getAllDeliveryFees() {
  if (!cachedDeliveryFees) {
    cachedDeliveryFees = await prisma.deliveryFee.findMany({
      where: { isActive: true },
      orderBy: { state: "asc" },
    });
  }
  return cachedDeliveryFees;
}

export async function getDeliveryFeeByState(state: string) {
  const resolved = resolveStateInfo(state);
  return await prisma.deliveryFee.findFirst({
    where: {
      isActive: true,
      OR: [
        { state },
        { stateCode: state },
        { state: resolved.state },
        { stateCode: resolved.stateCode },
      ],
    },
  });
}

export async function updateDeliveryFee(state: string, fee: number, updatedBy: string) {
  const resolved = resolveStateInfo(state);
  const existing = await prisma.deliveryFee.findFirst({
    where: {
      OR: [
        { state },
        { stateCode: state },
        { state: resolved.state },
        { stateCode: resolved.stateCode },
      ],
    },
  });

  const updatedFee = existing
    ? await prisma.deliveryFee.update({
        where: { id: existing.id },
        data: {
          state: resolved.state,
          stateCode: resolved.stateCode,
          fee,
          updatedBy,
          lastUpdated: new Date(),
        },
      })
    : await prisma.deliveryFee.create({
        data: {
          state: resolved.state,
          stateCode: resolved.stateCode,
          fee,
          updatedBy,
          lastUpdated: new Date(),
          isActive: true,
        },
      });

  // Update cache
  if (cachedDeliveryFees) {
    const index = cachedDeliveryFees.findIndex((f) => f.state === state || f.stateCode === state);
    if (index !== -1) {
      cachedDeliveryFees[index] = updatedFee;
    } else {
      cachedDeliveryFees.push(updatedFee);
    }
  }

  return updatedFee;
}

export async function refreshDeliveryFeesCache() {
  cachedDeliveryFees = await prisma.deliveryFee.findMany({
    where: { isActive: true },
    orderBy: { state: "asc" },
  });
  return cachedDeliveryFees;
}

async function initializeStates(defaultFee: number = 11, updatedBy: string = "system") {
  const tunisianStates = GOVERNORATES.map((item) => ({ ...item, fee: defaultFee }));

  for (const stateData of tunisianStates) {
    const existing = await prisma.deliveryFee.findFirst({
      where: {
        OR: [{ state: stateData.state }, { stateCode: stateData.stateCode }],
      },
    });

    if (existing) {
      await prisma.deliveryFee.update({
        where: { id: existing.id },
        data: { ...stateData, updatedBy, lastUpdated: new Date(), isActive: true },
      });
    } else {
      await prisma.deliveryFee.create({
        data: { ...stateData, updatedBy, lastUpdated: new Date(), isActive: true },
      });
    }
  }

  return prisma.deliveryFee.findMany({
    where: { isActive: true },
    orderBy: { state: "asc" },
  });
}
