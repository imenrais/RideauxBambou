import { DeliveryFee } from "@prisma/client";

import { prisma } from "./prisma";

let cachedDeliveryFees: DeliveryFee[] | null = null;

type DeliveryFeeBackupEntry = {
  state: string;
  stateCode: string;
  fee: number;
};

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

async function upsertDeliveryFeeAmount(
  stateOrCode: string,
  fee: number,
  updatedBy: string,
  options: { skipCacheRefresh?: boolean } = {}
) {
  const resolved = resolveStateInfo(stateOrCode);
  const existing = await prisma.deliveryFee.findFirst({
    where: {
      OR: [
        { state: stateOrCode },
        { stateCode: stateOrCode },
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

  if (!options.skipCacheRefresh) {
    await refreshDeliveryFeesCache();
  }

  return updatedFee;
}

export async function initializeDeliveryFees() {
  const fees = await initializeStates(11, "system");
  cachedDeliveryFees = fees;
  console.log("Delivery fees initialized for all Tunisian states");
}

export async function getAllDeliveryFees() {
  return refreshDeliveryFeesCache();
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
  const updatedFee = await upsertDeliveryFeeAmount(state, fee, updatedBy, { skipCacheRefresh: true });

  if (fee > 0) {
    await prisma.deliveryFeeSettings.upsert({
      where: { id: "default" },
      update: {
        isFreeDeliveryActive: false,
        updatedBy,
        lastUpdated: new Date(),
      },
      create: {
        id: "default",
        isFreeDeliveryActive: false,
        feeBackup: null,
        updatedBy,
      },
    });
  }

  await refreshDeliveryFeesCache();

  return updatedFee;
}

export async function refreshDeliveryFeesCache() {
  cachedDeliveryFees = await prisma.deliveryFee.findMany({
    where: { isActive: true },
    orderBy: { state: "asc" },
  });
  return cachedDeliveryFees;
}

export async function getDeliveryFeeSettings() {
  const existing = await prisma.deliveryFeeSettings.findUnique({
    where: { id: "default" },
  });

  if (existing) {
    return existing;
  }

  return prisma.deliveryFeeSettings.create({
    data: {
      id: "default",
      isFreeDeliveryActive: false,
      feeBackup: null,
      updatedBy: "system",
    },
  });
}

function buildDeliveryFeeBackup(fees: DeliveryFee[]): DeliveryFeeBackupEntry[] {
  return GOVERNORATES.map((governorate) => {
    const matchedFee = fees.find(
      (fee) =>
        fee.stateCode === governorate.stateCode ||
        normalizeGovernorate(fee.state) === normalizeGovernorate(governorate.state)
    );

    return {
      state: governorate.state,
      stateCode: governorate.stateCode,
      fee: matchedFee?.fee ?? 0,
    };
  });
}

function parseFeeBackup(value: unknown): DeliveryFeeBackupEntry[] | null {
  if (!value) {
    return null;
  }

  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const entries = parsed.filter(
    (entry): entry is DeliveryFeeBackupEntry =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as DeliveryFeeBackupEntry).stateCode === "string" &&
      typeof (entry as DeliveryFeeBackupEntry).fee === "number"
  );

  return entries.length > 0 ? entries : null;
}

export async function makeAllDeliveryFeesFree(updatedBy: string) {
  const currentFees = await refreshDeliveryFeesCache();
  const backup = buildDeliveryFeeBackup(currentFees);

  const settings = await prisma.deliveryFeeSettings.upsert({
    where: { id: "default" },
    update: {
      isFreeDeliveryActive: true,
      feeBackup: backup,
      updatedBy,
      lastUpdated: new Date(),
    },
    create: {
      id: "default",
      isFreeDeliveryActive: true,
      feeBackup: backup,
      updatedBy,
    },
  });

  const savedBackup = parseFeeBackup(settings.feeBackup);
  if (!savedBackup || savedBackup.length === 0) {
    throw new Error("Impossible de sauvegarder les tarifs avant l'activation de la livraison gratuite.");
  }

  for (const governorate of GOVERNORATES) {
    await upsertDeliveryFeeAmount(governorate.stateCode, 0, updatedBy, { skipCacheRefresh: true });
  }

  const fees = await refreshDeliveryFeesCache();

  return { fees, settings };
}

export async function restoreDeliveryFeesFromBackup(updatedBy: string) {
  const settings = await getDeliveryFeeSettings();
  const backup = parseFeeBackup(settings.feeBackup);

  if (!settings.isFreeDeliveryActive) {
    const fees = await refreshDeliveryFeesCache();
    return { fees, settings, restoredFromBackup: false };
  }

  if (!backup) {
    const updatedSettings = await prisma.deliveryFeeSettings.update({
      where: { id: "default" },
      data: {
        isFreeDeliveryActive: false,
        updatedBy,
        lastUpdated: new Date(),
      },
    });

    const fees = await refreshDeliveryFeesCache();
    return { fees, settings: updatedSettings, restoredFromBackup: false };
  }

  for (const entry of backup) {
    await upsertDeliveryFeeAmount(entry.stateCode, entry.fee, updatedBy, { skipCacheRefresh: true });
  }

  const updatedSettings = await prisma.deliveryFeeSettings.update({
    where: { id: "default" },
    data: {
      isFreeDeliveryActive: false,
      updatedBy,
      lastUpdated: new Date(),
    },
  });

  const fees = await refreshDeliveryFeesCache();

  return { fees, settings: updatedSettings, restoredFromBackup: true };
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
