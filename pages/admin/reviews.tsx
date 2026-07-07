import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ImageUpload from "../../components/ui/ImageUpload";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";

interface ReviewItem {
  _id: string;
  image: string;
  caption?: string;
  order: number;
  isActive: boolean;
}

interface AdminReviewsProps {
  title: string;
}

interface ReviewFormState {
  image: string;
  caption: string;
}

const defaultFormState: ReviewFormState = {
  image: "",
  caption: "",
};

export default function AdminReviews({ title }: AdminReviewsProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [form, setForm] = useState<ReviewFormState>(defaultFormState);
  const [editForm, setEditForm] = useState<ReviewFormState>(defaultFormState);
  const [orderedReviews, setOrderedReviews] = useState<ReviewItem[]>([]);
  const latestSavedOrderRef = useRef<string[]>([]);
  const [draggedReviewId, setDraggedReviewId] = useState<string | null>(null);
  const [dragOverReviewId, setDragOverReviewId] = useState<string | null>(null);
  const { success, error, warning } = useToast();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/login");
    }
  }, [session, status, router]);

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reviews");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur de chargement");
      }
      return data.data as ReviewItem[];
    },
  });

  const reviews = useMemo(() => (Array.isArray(reviewsData) ? reviewsData : []), [reviewsData]);

  useEffect(() => {
    setOrderedReviews(reviews);
    latestSavedOrderRef.current = reviews.map((item) => item._id);
  }, [reviews]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ReviewFormState) => {
      const response = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
      setForm(defaultFormState);
      success("Avis ajouté avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la suppression");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
      success("Avis supprimé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const response = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du reordonnancement");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });

  const handleStartEdit = (review: ReviewItem) => {
    setEditingReview(review);
    setEditForm({
      image: review.image || "",
      caption: review.caption || "",
    });
  };

  const handleCancelEdit = () => {
    setEditingReview(null);
    setEditForm(defaultFormState);
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReviewFormState }) => {
      const response = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la modification");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["public-reviews"] });
      setEditingReview(null);
      setEditForm(defaultFormState);
      success("Avis modifié avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image) {
      warning("Veuillez ajouter une image d'avis.");
      return;
    }
    saveMutation.mutate(form);
  };

  const handleDropOnReview = (targetId: string) => {
    if (!draggedReviewId || draggedReviewId === targetId) {
      setDragOverReviewId(null);
      return;
    }

    const current = [...orderedReviews];
    const fromIndex = current.findIndex((item) => item._id === draggedReviewId);
    const toIndex = current.findIndex((item) => item._id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDragOverReviewId(null);
      return;
    }

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setOrderedReviews(current);
    setDraggedReviewId(null);
    setDragOverReviewId(null);

    const newOrder = current.map((item) => item._id);
    latestSavedOrderRef.current = newOrder;
    reorderMutation.mutate(newOrder);
  };

  if (status === "loading" || isLoading) {
    return <Loading />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <AdminLayout title={title} description="Gestion des avis - Administration">
      <div className="mb-6">
        <BackButton />
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des Avis</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Ajoutez des captures d'ecran d'avis Facebook/Instagram et reordonnez-les par glisser-deposer.
        </p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
          {editingReview ? "Modifier un avis image" : "Ajouter un avis image"}
        </h2>
        {editingReview && (
          <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Mode édition activé. Modifiez puis cliquez sur "Modifier l'avis", ou annulez.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <ImageUpload value={form.image} onChange={(url) => setForm((prev) => ({ ...prev, image: url }))} />

          <div className="grid grid-cols-1 gap-4">
            <Input
              value={form.caption}
              onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
              placeholder="Texte court (optionnel)"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {editingReview && (
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? "Enregistrement..."
                : editingReview
                  ? "Modifier l'avis"
                  : "Ajouter l'avis"}
            </Button>
          </div>
        </form>
      </Card>

      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Réorganisez les cartes par drag & drop.</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {orderedReviews.map((review) => (
          <motion.div
            key={review._id}
            layout
            draggable
            onDragStart={() => {
              setDraggedReviewId(review._id);
              setDragOverReviewId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverReviewId !== review._id) {
                setDragOverReviewId(review._id);
              }
            }}
            onDrop={() => handleDropOnReview(review._id)}
            onDragEnd={() => {
              setDraggedReviewId(null);
              setDragOverReviewId(null);
            }}
            animate={{
              scale: draggedReviewId === review._id ? 1.02 : 1,
              opacity: draggedReviewId === review._id ? 0.9 : 1,
              y: dragOverReviewId === review._id && draggedReviewId !== review._id ? -6 : 0,
            }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            whileDrag={{
              scale: 1.04,
              rotate: 1.5,
              boxShadow: "0px 14px 28px rgba(0,0,0,0.18)",
              zIndex: 20,
            }}
            className="cursor-grab list-none active:cursor-grabbing"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="h-full overflow-hidden p-0">
                <div className="relative h-56 w-full bg-gray-100 dark:bg-gray-700">
                  <Image src={review.image} alt="Capture d'ecran d'avis client" fill className="object-cover" />
                </div>
                <div className="space-y-2 p-4">
                  {review.caption && <p className="text-sm text-gray-600 dark:text-gray-300">{review.caption}</p>}
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={() => handleStartEdit(review)}>
                      Modifier
                    </Button>
                    <Button
                      type="button"
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => deleteMutation.mutate(review._id)}
                      disabled={deleteMutation.isPending}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Modifier l&apos;avis
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editForm.image) {
                  warning("Veuillez ajouter une image d'avis.");
                  return;
                }
                editMutation.mutate({ id: editingReview._id, payload: editForm });
              }}
              className="space-y-4"
            >
              <ImageUpload
                value={editForm.image}
                onChange={(url) => setEditForm((prev) => ({ ...prev, image: url }))}
              />
              <Input
                value={editForm.caption}
                onChange={(e) => setEditForm((prev) => ({ ...prev, caption: e.target.value }))}
                placeholder="Texte court (optionnel)"
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                  Annuler
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Gestion des Avis - Administration");
