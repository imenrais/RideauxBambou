import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/Table";

interface Product {
  _id: string;
  name: string;
  image: string;
  createdAt: string;
}

interface ProductTableProps {
  products: Product[];
  globalPrice: number;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
}

export default function ProductTable({
  products,
  globalPrice,
  onEdit,
  onDelete,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) {
      deleteMutation.mutate(id);
      onDelete(id);
    }
  };

  return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Nom</TableHead>
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
                    src={product.image || "/logo.png"}
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
              <TableCell align="center" className="font-medium">
                {globalPrice.toFixed(2)} TND
              </TableCell>
              <TableCell align="center">
                <div className="flex justify-center space-x-2">
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
