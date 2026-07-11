import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Button from "../ui/Button";
import ImageUpload from "../ui/ImageUpload";
import Input from "../ui/Input";
import { formFieldLabelClass } from "../../lib/form-field-styles";

const productSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  image: z
    .string()
    .min(1, "L'image est requise")
    .refine(
      (value) => {
        // Accept both URLs and relative paths starting with /uploads/
        return value.startsWith("http") || value.startsWith("/uploads/");
      },
      {
        message: "L'URL de l'image doit être valide",
      }
    ),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product {
  _id?: string;
  name: string;
  image: string;
}

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ProductForm({ product, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      name: "",
      image: "",
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className={formFieldLabelClass}>
            Nom du produit *
          </label>
          <Input {...register("name")} error={errors.name?.message} className="mt-1" />
        </div>

        <div>
          <label className={formFieldLabelClass}>
            Image du produit *
          </label>
          <ImageUpload
            value={watch("image")}
            onChange={(url) => setValue("image", url)}
            error={errors.image?.message}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" onClick={handleSubmit(onSubmit)} disabled={isLoading}>
          {isLoading ? "Enregistrement..." : product ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </motion.div>
  );
}
