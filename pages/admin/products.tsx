import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { notifyProductsUpdated } from "../../lib/product-availability-sync";
import { PRODUCTS_QUERY_KEY } from "../../lib/products-query";

const ProductTable = dynamic(() => import("../../components/admin/ProductTable"), {
  loading: () => <div className="p-4 text-center">Chargement...</div>,
});

const ProductForm = dynamic(() => import("../../components/admin/ProductForm"), {
  loading: () => <div className="p-4 text-center">Chargement...</div>,
});

interface Product {
  _id: string;
  name: string;
  image: string;
  isAvailable: boolean;
  createdAt: string;
}

const normalizeAvailability = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    if (normalized === "true" || normalized === "1") {
      return true;
    }
  }

  if (typeof value === "number") {
    if (value === 0) {
      return false;
    }
    if (value === 1) {
      return true;
    }
  }

  return true;
};

const normalizeProduct = (product: Product | Record<string, unknown>): Product => ({
  ...(product as Product),
  isAvailable: normalizeAvailability((product as Product).isAvailable),
});

const updateAvailabilityInCache = (
  cachedData: Product[] | undefined,
  id: string,
  isAvailable: boolean
) =>
  Array.isArray(cachedData)
    ? cachedData.map((product) =>
        product._id === id
          ? {
              ...product,
              isAvailable,
            }
          : product
      )
    : cachedData;

const upsertProductInCache = (cachedData: Product[] | undefined, product: Product, prepend = false) => {
  if (!Array.isArray(cachedData)) {
    return cachedData;
  }

  const exists = cachedData.some((existingProduct) => existingProduct._id === product._id);
  if (exists) {
    return cachedData.map((existingProduct) =>
      existingProduct._id === product._id ? product : existingProduct
    );
  }

  return prepend ? [product, ...cachedData] : cachedData;
};

const ADMIN_PRODUCTS_QUERY_KEY = ["admin-products"] as const;
const ADMIN_PRODUCTS_STATS_QUERY_KEY = ["admin-products-stats"] as const;

export default function AdminProducts() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { success, error } = useToast();

  // Fetch global price
  const { data: globalPriceData } = useQuery({
    queryKey: ["global-price"],
    queryFn: async () => {
      const response = await fetch("/api/admin/price");
      const data = await response.json();
      return data.success ? data.data : { pricePerM2: 50 };
    },
    enabled: status === "authenticated" && session?.user?.role === "admin",
  });

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const response = await fetch("/api/admin/products");
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.map((product: Product) => normalizeProduct(product));
    },
    enabled: status === "authenticated" && session?.user?.role === "admin",
  });

  // Create/Update product mutation
  const productMutation = useMutation({
    mutationFn: async (productData: any) => {
      const url = editingProduct
        ? `/api/admin/products?id=${editingProduct._id}`
        : "/api/admin/products";
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save product");
      }
      return response.json();
    },
    onSuccess: (result) => {
      const updatedProduct = result?.data ? normalizeProduct(result.data) : null;
      const isEditing = Boolean(editingProduct);

      if (updatedProduct) {
        queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_QUERY_KEY, (oldData) =>
          upsertProductInCache(oldData, updatedProduct, !isEditing)
        );
        queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_STATS_QUERY_KEY, (oldData) =>
          upsertProductInCache(oldData, updatedProduct, !isEditing)
        );
      }

      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
      notifyProductsUpdated();
      setShowModal(false);
      setEditingProduct(null);
      success(editingProduct ? "Produit modifié avec succès." : "Produit créé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const response = await fetch(`/api/admin/products?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update availability");
      }
      const data = await response.json();
      return data.data ? normalizeProduct(data.data) : null;
    },
    onMutate: async ({ id, isAvailable }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ADMIN_PRODUCTS_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: ADMIN_PRODUCTS_STATS_QUERY_KEY }),
        queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY }),
      ]);

      const previousAdminProducts = queryClient.getQueryData<Product[]>(ADMIN_PRODUCTS_QUERY_KEY);
      const previousAdminProductsStats = queryClient.getQueryData<Product[]>(ADMIN_PRODUCTS_STATS_QUERY_KEY);
      const previousProducts = queryClient.getQueryData<Product[]>(PRODUCTS_QUERY_KEY);

      queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_QUERY_KEY, (oldData) =>
        updateAvailabilityInCache(oldData, id, isAvailable)
      );
      queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_STATS_QUERY_KEY, (oldData) =>
        updateAvailabilityInCache(oldData, id, isAvailable)
      );
      queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (oldData) =>
        updateAvailabilityInCache(oldData, id, isAvailable)
      );

      return {
        previousAdminProducts,
        previousAdminProductsStats,
        previousProducts,
      };
    },
    onSuccess: (updatedProduct, variables) => {
      if (updatedProduct) {
        queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_QUERY_KEY, (oldData) =>
          Array.isArray(oldData)
            ? oldData.map((product) =>
                product._id === updatedProduct._id ? updatedProduct : product
              )
            : oldData
        );
        queryClient.setQueryData<Product[]>(ADMIN_PRODUCTS_STATS_QUERY_KEY, (oldData) =>
          Array.isArray(oldData)
            ? oldData.map((product) =>
                product._id === updatedProduct._id ? updatedProduct : product
              )
            : oldData
        );
        queryClient.setQueryData<Product[]>(PRODUCTS_QUERY_KEY, (oldData) =>
          Array.isArray(oldData)
            ? oldData.map((product) =>
                product._id === updatedProduct._id ? updatedProduct : product
              )
            : oldData
        );
      }
      success(
        variables.isAvailable
          ? "Produit rendu disponible."
          : "Produit marqué hors stock."
      );
      notifyProductsUpdated();
    },
    onError: (mutationError, _variables, context) => {
      if (context?.previousAdminProducts) {
        queryClient.setQueryData(ADMIN_PRODUCTS_QUERY_KEY, context.previousAdminProducts);
      }
      if (context?.previousAdminProductsStats) {
        queryClient.setQueryData(ADMIN_PRODUCTS_STATS_QUERY_KEY, context.previousAdminProductsStats);
      }
      if (context?.previousProducts) {
        queryClient.setQueryData(PRODUCTS_QUERY_KEY, context.previousProducts);
      }

      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = (_id: string) => {
    // This will be handled by the ProductTable component
  };

  const handleToggleAvailability = (id: string, isAvailable: boolean) => {
    availabilityMutation.mutate({ id, isAvailable });
  };

  const handleFormSubmit = (data: any) => {
    productMutation.mutate(data);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  if (status === "loading" || isLoading) {
    return <Loading />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <AdminLayout title="Gestion des Produits - Administration" description="Gestion des produits - Administration">
      <div className="mb-4 sm:mb-6">
        <BackButton />
      </div>
      <div className="mb-4 sm:mb-10 lg:mb-14">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <h1 className="min-w-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Gestion des Produits
          </h1>
          <Button
            type="button"
            size="sm"
            icon={<FiPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            onClick={() => setShowModal(true)}
            className="shrink-0 !inline-flex !items-center !leading-none rounded-lg px-2.5 py-1.5 text-xs shadow-md sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm sm:shadow-lg"
          >
            <span className="sm:hidden">Ajouter</span>
            <span className="hidden sm:inline">Ajouter un produit</span>
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 sm:mt-2 sm:text-base">
          Gérez votre catalogue de produits
        </p>
      </div>

      <div className="mx-auto w-full max-w-full overflow-visible rounded-lg bg-white shadow-lg dark:bg-gray-800 md:max-w-4xl md:overflow-x-auto">
        <ProductTable
          products={Array.isArray(productsData) ? productsData : []}
          priceSettings={{
            pricePerM2: globalPriceData?.pricePerM2 || 50,
            salePricePerM2: globalPriceData?.salePricePerM2,
            isSaleActive: globalPriceData?.isSaleActive,
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleAvailability={handleToggleAvailability}
          isUpdatingAvailability={availabilityMutation.isPending}
        />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
              {editingProduct ? "Modifier le produit" : "Nouveau produit"}
            </h2>

            <ProductForm
              product={editingProduct || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseModal}
              isLoading={productMutation.isPending}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export { requireAdminPage as getServerSideProps } from "../../lib/require-admin-page";

