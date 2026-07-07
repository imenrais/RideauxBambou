import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSimpleCart } from "../../contexts/SimpleCartContext";
import Button from "./Button";

interface DimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
  product: {
    _id: string;
    name: string;
    image: string;
  };
}

export default function DimensionModal({ isOpen, onClose, onAdded, product }: DimensionModalProps) {
  const { addItem, calculatePrice } = useSimpleCart();
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(220); // Default to 220cm for panneau
  const [curtainType, setCurtainType] = useState<"panneau" | "store">("panneau");
  const [quantity, setQuantity] = useState(1);
  const [priceCalculation, setPriceCalculation] = useState({ area: 0, pricePerM2: 0, total: 0 });

  // Reset dimensions when modal opens
  useEffect(() => {
    if (isOpen) {
      if (curtainType === "panneau") {
        setHeight(220);
        setWidth(100);
      } else {
        setHeight(200);
        setWidth(100);
      }
      setQuantity(1);
    }
  }, [isOpen, curtainType]);

  // Reset dimensions when curtain type changes
  useEffect(() => {
    if (curtainType === "panneau") {
      // Panneau: fixed height at 220cm (2m20), width options: 100cm or 130cm
      setHeight(220);
      // Reset width to default if not one of the valid options
      setWidth((prevWidth) => (prevWidth === 100 || prevWidth === 130 ? prevWidth : 100));
    } else {
      // Store: allow free input (reset height if it was set to panneau default)
      setHeight((prevHeight) => (prevHeight === 220 ? 200 : prevHeight));
    }
  }, [curtainType]);

  // Calculate price when dimensions change
  useEffect(() => {
    const calculation = calculatePrice(width, height);
    setPriceCalculation(calculation);
  }, [width, height, calculatePrice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addItem({
      productId: product._id,
      productName: product.name,
      productImage: product.image,
      quantity,
      width,
      height,
      curtainType,
    });

    onAdded?.();
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "TND",
    }).format(price);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configurer votre rideau
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{product.name}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Curtain Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type de rideau
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="panneau"
                    checked={curtainType === "panneau"}
                    onChange={(e) => setCurtainType(e.target.value as "panneau" | "store")}
                    className="mr-2"
                  />
                  <span className="text-sm">Panneau</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="store"
                    checked={curtainType === "store"}
                    onChange={(e) => setCurtainType(e.target.value as "panneau" | "store")}
                    className="mr-2"
                  />
                  <span className="text-sm">Store</span>
                </label>
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Largeur (cm)
                </label>
                {curtainType === "panneau" ? (
                  <select
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value={100}>1m (100cm)</option>
                    <option value={130}>1m30 (130cm)</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hauteur (cm)
                </label>
                {curtainType === "panneau" ? (
                  <input
                    type="number"
                    value={220}
                    disabled
                    className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  />
                ) : (
                  <input
                    type="number"
                    min="100"
                    max="250"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    required
                  />
                )}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quantité
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={quantity}
                  readOnly
                  className="w-12 rounded-md border border-gray-300 px-0 py-2 text-center text-sm font-medium focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  style={{ textAlign: "center" }}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((prev) => Math.min(10, prev + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Price Calculation */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
              <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Calcul du prix
              </h4>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Prix par m²:</span>
                  <span>{formatPrice(priceCalculation.pricePerM2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                  <span>Total:</span>
                  <span>{formatPrice(priceCalculation.total)}</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                Ajouter au panier
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}


