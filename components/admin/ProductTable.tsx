import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";

import { notifyProductsUpdated } from "../../lib/product-availability-sync";
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
  adminTableComfortableSpacingClassName,
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
      <Table className={adminTableComfortableSpacingClassName}>
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
                  <Image
                    src={product.image || "/images/logo.png"}
                    alt={product.name || "Product image"}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                </div>
              </TableCell>
              <TableCell align="center">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {product.name || "Nom non défini"}
                  </div>
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
  );
}
