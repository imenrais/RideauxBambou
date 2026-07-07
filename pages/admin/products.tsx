import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";

const ProductTable = dynamic(() => import("../../components/admin/ProductTable"), {
  loading: () => <div className="p-4 text-center">Chargement...</div>,
});

const ProductForm = dynamic(() => import("../../components/admin/ProductForm"), {
  loading: () => <div className="p-4 text-center">Chargement...</div>,
});

interface AdminProductsProps {
  title: string;
}

interface Product {
  _id: string;
  name: string;
  image: string;
  createdAt: string;
}

export default function AdminProducts({ title }: AdminProductsProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { success, error } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/login");
    }
  }, [session, status, router]);

  // Fetch global price
  const { data: globalPriceData } = useQuery({
    queryKey: ["global-price"],
    queryFn: async () => {
      const response = await fetch("/api/admin/price");
      const data = await response.json();
      return data.success ? data.data : { pricePerM2: 50 };
    },
  });

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const response = await fetch("/api/admin/products");
      const data = await response.json();
      console.log("Products data:", data);
      return data.data;
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowModal(false);
      setEditingProduct(null);
      success(editingProduct ? "Produit modifié avec succès." : "Produit créé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/products?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      success("Produit supprimé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    // This will be handled by the ProductTable component
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
    <AdminLayout title={title} description="Gestion des produits - Administration">
      <div className="mb-6">
        <BackButton />
      </div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des Produits</h1>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600 dark:text-gray-400">Gérez votre catalogue de produits</p>
        <Button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700">
          Ajouter un produit
        </Button>
      </div>

      <Card padding="lg">
        <ProductTable
          products={Array.isArray(productsData) ? productsData : []}
          globalPrice={globalPriceData?.pricePerM2 || 50}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </Card>

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

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Gestion des Produits - Administration");
