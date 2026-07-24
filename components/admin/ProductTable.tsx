import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";

import { notifyProductsUpdated } from "../../lib/product-availability-sync";
import { formSelectClass } from "../../lib/form-field-styles";
import { PRODUCTS_QUERY_KEY } from "../../lib/products-query";
import Button from "../ui/Button";
import PriceDisplay from "../ui/PriceDisplay";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table";

interface Product {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
  createdAt: string;
}

interface ProductTableProps {
  products: Product[];
  priceSettings: {
    pricePerM2: number;
    salePricePerM2?: number | null;
    isSaleActive?: boolean;
  };
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleAvailability: (id: string, isAvailable: boolean) => void;
  isUpdatingAvailability: boolean;
}

const availabilityBadgeClass = {
  available:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  out_of_stock: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const removeProductFromCache = (cachedData: Product[] | undefined, id: string) =>
  Array.isArray(cachedData) ? cachedData.filter((product) => product._id !== id) : cachedData;

export default function ProductTable({
  products,
  priceSettings,
  onEdit,
  onDelete,
  onToggleAvailability,
  isUpdatingAvailability,
}: ProductTableProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/products?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
      return response.json();
    },
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["admin-products"] }),
        queryClient.cancelQueries({ queryKey: ["admin-products-stats"] }),
        queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY }),
      ]);

      const previousAdminProducts = queryClient.getQueryData<Product[]>(["admin-products"]);
      const previousAdminProductsStats = queryClient.getQueryData<Product[]>(["admin-products-stats"]);
      const previousProducts = queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEY);

      queryClient.setQueryData<Product[]>(["admin-products"], (oldData) =>
        removeProductFromCache(oldData, id)
      );
      queryClient.setQueryData<Product[]>(["admin-products-stats"], (oldData) =>
        removeProductFromCache(oldData, id)
      );
      queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (oldData) =>
        removeProductFromCache(oldData, id)
      );

      return {
        previousAdminProducts,
        previousAdminProductsStats,
        previousProducts,
      };
    },
    onError: (_mutationError, _variables, context) => {
      if (context?.previousAdminProducts) {
        queryClient.setQueryData(["admin-products"], context.previousAdminProducts);
      }
      if (context?.previousAdminProductsStats) {
        queryClient.setQueryData(["admin-products-stats"], context.previousAdminProductsStats);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      notifyProductsUpdated();
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      deleteMutation.mutate(id);
      onDelete(id);
    }
  };

  return (
    <>
      <div className="space-y-2.5 overflow-visible p-2.5 md:hidden">
        {products.map((product) => {
          const available = product.isAvailable;
          return (
            <div
              key={`${product._id}-mobile`}
              className="rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/90 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/60">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name || "Product image"}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900 dark:text-white">
                      {product.name || "Nom non défini"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.createdAt
                        ? new Date(product.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex max-w-full shrink-0 whitespace-normal rounded-full px-2.5 py-1 text-xs font-semibold ${
                    available
                      ? availabilityBadgeClass.available
                      : availabilityBadgeClass.out_of_stock
                  }`}
                >
                  {available ? "Disponible" : "Hors stock"}
                </span>
              </div>

              <div className="space-y-3 p-3">
                <div className="grid grid-cols-1 gap-2.5 rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/50">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Prix</p>
                    <div className="mt-0.5 break-words text-sm font-semibold text-gray-900 dark:text-white">
                      <PriceDisplay
                        pricePerM2={priceSettings.pricePerM2}
                        salePricePerM2={priceSettings.salePricePerM2}
                        isSaleActive={priceSettings.isSaleActive}
                        suffix=" TND"
                        className="text-sm font-semibold"
                        saleClassName="text-sm font-semibold text-green-600 dark:text-green-400"
                        listClassName="text-sm font-normal text-gray-500 line-through dark:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                  <label className="sr-only" htmlFor={`mobile-availability-${product._id}`}>
                    Disponibilité
                  </label>
                  <select
                    id={`mobile-availability-${product._id}`}
                    value={available ? "available" : "out_of_stock"}
                    onChange={(e) =>
                      onToggleAvailability(product._id, e.target.value === "available")
                    }
                    disabled={isUpdatingAvailability}
                    className={`${formSelectClass} !box-border h-9 w-[36%] max-w-[36%] shrink-0 !rounded-lg !border-gray-200 !px-2.5 !py-0 !text-sm !leading-none dark:!border-gray-600`}
                  >
                    <option value="available">Disponible</option>
                    <option value="out_of_stock">Hors stock</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="ml-auto box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                    onClick={() => onEdit(product)}
                  >
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    className="box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                    onClick={() => handleDelete(product._id)}
                    disabled={deleteMutation.isPending}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden w-full md:block">
        <Table className="!w-full [&_th]:!px-3 [&_th]:!py-3 [&_td]:!px-3 [&_td]:!py-3.5">
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Disponibilité</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product._id}>
                <TableCell align="center">
                  <div className="flex justify-center">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name || "Product image"}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell align="center">
                  <div className="inline-flex flex-col items-center gap-1.5">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {product.name || "Nom non défini"}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        product.isAvailable
                          ? availabilityBadgeClass.available
                          : availabilityBadgeClass.out_of_stock
                      }`}
                    >
                      {product.isAvailable ? "Disponible" : "Hors stock"}
                    </span>
                  </div>
                </TableCell>
                <TableCell align="center">
                  <select
                    value={product.isAvailable ? "available" : "out_of_stock"}
                    onChange={(e) =>
                      onToggleAvailability(product._id, e.target.value === "available")
                    }
                    disabled={isUpdatingAvailability}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    aria-label="Modifier la disponibilité"
                  >
                    <option value="available">Disponible</option>
                    <option value="out_of_stock">Hors stock</option>
                  </select>
                </TableCell>
                <TableCell align="center">
                  <PriceDisplay
                    pricePerM2={priceSettings.pricePerM2}
                    salePricePerM2={priceSettings.salePricePerM2}
                    isSaleActive={priceSettings.isSaleActive}
                    suffix=" TND"
                    className="text-sm font-normal"
                    saleClassName="text-sm font-normal text-green-600 dark:text-green-400"
                    listClassName="text-sm font-normal text-gray-500 line-through dark:text-gray-400"
                  />
                </TableCell>
                <TableCell align="center">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onEdit(product)}>
                      Modifier
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(product._id)}
                      disabled={deleteMutation.isPending}
                    >
                      Supprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
