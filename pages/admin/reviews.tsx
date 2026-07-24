import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiMenu, FiPlus } from "react-icons/fi";

import BackButton from "../../components/BackButton";
import AdminLayout from "../../components/layout/AdminLayout";
import Button from "../../components/ui/Button";
import ImageUpload from "../../components/ui/ImageUpload";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";

interface ReviewItem {
  _id: string;
  image: string;
  caption?: string;
  order: number;
  isActive: boolean;
}

interface ReviewFormState {
  image: string;
  caption: string;
}

const defaultFormState: ReviewFormState = {
  image: "",
  caption: "",
};

const modalActionBtnClass =
  "!inline-flex !w-auto shrink-0 !rounded-lg !px-3 !py-1.5 !text-xs !leading-none sm:!rounded-xl sm:!px-4 sm:!py-2 sm:!text-sm";

export default function AdminReviews() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [form, setForm] = useState<ReviewFormState>(defaultFormState);
  const [editForm, setEditForm] = useState<ReviewFormState>(defaultFormState);
  const [orderedReviews, setOrderedReviews] = useState<ReviewItem[]>([]);
  const orderedReviewsRef = useRef<ReviewItem[]>([]);
  const latestSavedOrderRef = useRef<string[]>([]);
  const pointerDragIdRef = useRef<string | null>(null);
  const [draggedReviewId, setDraggedReviewId] = useState<string | null>(null);
  const [dragOverReviewId, setDragOverReviewId] = useState<string | null>(null);
  const { success, error, warning } = useToast();

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/connexion");
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
    orderedReviewsRef.current = reviews;
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
      setShowAddModal(false);
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

  const handleCloseAddModal = () => {
    if (saveMutation.isPending) return;
    setShowAddModal(false);
    setForm(defaultFormState);
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

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet avis ?")) {
      deleteMutation.mutate(id);
    }
  };

  const moveReview = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) {
      return orderedReviewsRef.current;
    }

    const current = [...orderedReviewsRef.current];
    const fromIndex = current.findIndex((item) => item._id === fromId);
    const toIndex = current.findIndex((item) => item._id === toId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return current;
    }

    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    orderedReviewsRef.current = current;
    setOrderedReviews(current);
    return current;
  };

  const commitOrder = (list: ReviewItem[]) => {
    const newOrder = list.map((item) => item._id);
    const previous = latestSavedOrderRef.current.join(",");
    if (newOrder.join(",") === previous) {
      return;
    }
    latestSavedOrderRef.current = newOrder;
    reorderMutation.mutate(newOrder);
  };

  const handleDropOnReview = (targetId: string) => {
    if (!draggedReviewId || draggedReviewId === targetId) {
      setDragOverReviewId(null);
      return;
    }

    const next = moveReview(draggedReviewId, targetId);
    setDraggedReviewId(null);
    setDragOverReviewId(null);
    commitOrder(next);
  };

  const dragHandlers = (reviewId: string) => ({
    draggable: true as const,
    onDragStart: () => {
      setDraggedReviewId(reviewId);
      setDragOverReviewId(null);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragOverReviewId !== reviewId) {
        setDragOverReviewId(reviewId);
      }
    },
    onDrop: () => handleDropOnReview(reviewId),
    onDragEnd: () => {
      setDraggedReviewId(null);
      setDragOverReviewId(null);
    },
  });

  const handleTouchReorderPointerDown = (reviewId: string) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    pointerDragIdRef.current = reviewId;
    setDraggedReviewId(reviewId);
    setDragOverReviewId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTouchReorderPointerMove = (e: React.PointerEvent) => {
    const fromId = pointerDragIdRef.current;
    if (!fromId) {
      return;
    }

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const card = target?.closest("[data-review-id]") as HTMLElement | null;
    const toId = card?.dataset.reviewId;
    if (!toId || toId === fromId) {
      return;
    }

    moveReview(fromId, toId);
    setDragOverReviewId(toId);
  };

  const handleTouchReorderPointerUp = (e: React.PointerEvent) => {
    if (!pointerDragIdRef.current) {
      return;
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }

    pointerDragIdRef.current = null;
    setDraggedReviewId(null);
    setDragOverReviewId(null);
    commitOrder(orderedReviewsRef.current);
  };

  const dragClassName = (reviewId: string) =>
    [
      "cursor-grab active:cursor-grabbing",
      draggedReviewId === reviewId ? "scale-[1.01] opacity-90 shadow-md" : "",
      dragOverReviewId === reviewId && draggedReviewId !== reviewId ? "-translate-y-1" : "",
    ]
      .filter(Boolean)
      .join(" ");

  if (status === "loading" || isLoading) {
    return <Loading />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <AdminLayout title="Gestion des Avis - Administration" description="Gestion des avis - Administration">
      <div className="mb-4 sm:mb-6">
        <BackButton href="/admin" />
      </div>

      <div className="mb-4 sm:mb-10 lg:mb-14">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <h1 className="min-w-0 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Gestion des Avis
          </h1>
          <Button
            type="button"
            size="sm"
            icon={<FiPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            onClick={() => setShowAddModal(true)}
            className="shrink-0 !inline-flex !items-center !leading-none rounded-lg px-2.5 py-1.5 text-xs shadow-md sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm sm:shadow-lg"
          >
            <span className="sm:hidden">Ajouter</span>
            <span className="hidden sm:inline">Ajouter un avis</span>
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 sm:mt-2 sm:text-base">
          Ajoutez des captures d&apos;écran d&apos;avis
        </p>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 md:hidden">
          Glissez la poignée ≡ pour réordonner
        </p>
      </div>

      <div className="mx-auto w-full max-w-full overflow-visible rounded-lg bg-white shadow-lg dark:bg-gray-800 md:w-fit md:max-w-4xl">
        {orderedReviews.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucun avis pour le moment.
          </div>
        ) : (
          <>
            <div className="space-y-2.5 overflow-visible p-2.5 md:hidden">
              {orderedReviews.map((review, index) => (
                <div
                  key={`${review._id}-mobile`}
                  data-review-id={review._id}
                  className={`rounded-xl border border-gray-200/90 bg-white shadow-sm transition-transform dark:border-gray-700 dark:bg-gray-900 ${dragClassName(review._id)}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/90 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/60">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Déplacer l'avis ${index + 1}`}
                        className="inline-flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm active:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:active:bg-gray-700"
                        onPointerDown={handleTouchReorderPointerDown(review._id)}
                        onPointerMove={handleTouchReorderPointerMove}
                        onPointerUp={handleTouchReorderPointerUp}
                        onPointerCancel={handleTouchReorderPointerUp}
                      >
                        <FiMenu className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <Image
                        src={review.image || "/images/logo.png"}
                        alt="Capture d'écran d'avis client"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        draggable={false}
                      />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-gray-900 dark:text-white">
                          Avis #{index + 1}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {review.caption || "Sans légende"}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex max-w-full shrink-0 whitespace-normal rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="space-y-3 p-3">
                    <div className="overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <div className="relative h-52 w-full">
                        <Image
                          src={review.image}
                          alt="Capture d'écran d'avis client"
                          fill
                          sizes="100vw"
                          className="object-contain"
                          draggable={false}
                        />
                      </div>
                      {review.caption ? (
                        <div className="p-2.5">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Légende
                          </p>
                          <p className="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                            {review.caption}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="ml-auto box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                        onClick={() => handleStartEdit(review)}
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        className="box-border !h-9 shrink-0 !rounded-lg !px-3 !py-0 !text-xs !leading-none !shadow-sm"
                        onClick={() => handleDelete(review._id)}
                        disabled={deleteMutation.isPending}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden p-4 md:block sm:p-6">
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Réorganisez les cartes par drag & drop.
              </p>
              <div className="flex flex-wrap gap-4 sm:gap-6">
                {orderedReviews.map((review, index) => (
                  <div
                    key={review._id}
                    {...dragHandlers(review._id)}
                    className={`flex w-[15.5rem] flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 ${dragClassName(review._id)}`}
                  >
                    <div className="relative h-52 w-full shrink-0 bg-gray-100 dark:bg-gray-700">
                      <Image
                        src={review.image}
                        alt="Capture d'écran d'avis client"
                        fill
                        sizes="248px"
                        className="object-cover object-top"
                        draggable={false}
                      />
                    </div>
                    <div className="flex flex-1 flex-col space-y-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Avis #{index + 1}
                      </p>
                      {review.caption ? (
                        <p className="text-sm text-gray-600 dark:text-gray-300">{review.caption}</p>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500">Sans légende</p>
                      )}
                      <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartEdit(review)}
                        >
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(review._id)}
                          disabled={deleteMutation.isPending}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
              Ajouter un avis
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <ImageUpload
                value={form.image}
                onChange={(url) => setForm((prev) => ({ ...prev, image: url }))}
                previewFit="contain"
                previewContainerClassName="h-72"
              />
              <Input
                value={form.caption}
                onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
                placeholder="Texte court (optionnel)"
              />
              <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={modalActionBtnClass}
                  onClick={handleCloseAddModal}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className={modalActionBtnClass}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Enregistrement..." : "Ajouter l'avis"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-4 dark:bg-gray-800 sm:p-6">
            <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
              Modifier l&apos;avis
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editForm.image) {
                  warning("Veuillez ajouter une image d'avis.");
                  return;
                }
                editMutation.mutate({ id: editingReview._id, payload: editForm });
              }}
              className="space-y-4 sm:space-y-6"
            >
              <ImageUpload
                value={editForm.image}
                onChange={(url) => setEditForm((prev) => ({ ...prev, image: url }))}
                previewFit="contain"
                previewContainerClassName="h-72"
              />
              <Input
                value={editForm.caption}
                onChange={(e) => setEditForm((prev) => ({ ...prev, caption: e.target.value }))}
                placeholder="Texte court (optionnel)"
              />
              <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={modalActionBtnClass}
                  onClick={handleCancelEdit}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className={modalActionBtnClass}
                  disabled={editMutation.isPending}
                >
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
