import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pageMainClass, pageShellClass } from "../../lib/design-system";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import AdminNavigation from "../../components/AdminNavigation";
import BackButton from "../../components/BackButton";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import PasswordInput from "../../components/ui/PasswordInput";
import {
  adminTableRoomySpacingClassName,
  adminTableShellClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { useToast } from "../../contexts/ToastContext";
import { requireAdminPage } from "../../lib/admin-page-guard";
import { formFieldLabelClass, formSelectClass } from "../../lib/form-field-styles";
import { getEmailValidationError, normalizeEmailValue } from "../../lib/email-validation";
import { checkPasswordStrength } from "../../lib/password-validation";

interface AdminUsersProps {
  title: string;
}

const roleColors = {
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  worker: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function AdminUsers({ title }: AdminUsersProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedRole] = useState("worker");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("");
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [workerEditForm, setWorkerEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
  });
  const [workerForm, setWorkerForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
  });
  const [workerCreateError, setWorkerCreateError] = useState("");
  const [workerCreateEmailError, setWorkerCreateEmailError] = useState("");
  const [workerEditEmailError, setWorkerEditEmailError] = useState("");
  const { success, error } = useToast();

  // Redirect if not admin
  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user?.role !== "admin") {
      router.push("/connexion");
    }
  }, [session, status, router]);

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", selectedRole, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(selectedRole && { role: selectedRole }),
      });

      const response = await fetch(`/api/admin/users?${params}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
  });
  const workers = (usersData?.users || []).filter((user: any) => user.role === "worker");

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
      setNewRole("");
      success("Rôle utilisateur mis à jour.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleRoleUpdate = (userId: string) => {
    if (newRole) {
      updateRoleMutation.mutate({ userId, role: newRole });
    }
  };

  const createWorkerMutation = useMutation({
    mutationFn: async (payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      password: string;
    }) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setWorkerForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "",
      });
      setWorkerCreateError("");
      success("Compte employé créé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      setWorkerCreateError(message);
      error(`Erreur: ${message}`);
    },
  });

  const updateWorkerMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: { firstName: string; lastName: string; email: string; role?: string; password?: string };
    }) => {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingWorker(null);
      setWorkerEditForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: "",
      });
      success("Compte employé mis à jour.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const deleteWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      success("Compte employé supprimé avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleCreateWorker = (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerCreateError("");
    const normalizedRole = workerForm.role.trim().toLowerCase();
    const normalizedEmail = normalizeEmailValue(workerForm.email);
    const emailValidationError = getEmailValidationError(normalizedEmail, { required: true });
    setWorkerForm((prev) => ({ ...prev, email: normalizedEmail }));
    setWorkerCreateEmailError(emailValidationError);
    if (emailValidationError) {
      setWorkerCreateError(emailValidationError);
      return;
    }

    if (!normalizedRole) {
      setWorkerCreateError("Le rôle est requis.");
      error("Le rôle est requis.");
      return;
    }
    if (workerForm.password !== workerForm.confirmPassword) {
      setWorkerCreateError("La confirmation du mot de passe ne correspond pas.");
      error("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    const strength = checkPasswordStrength(workerForm.password);
    if (!strength.isValid) {
      const message = `Mot de passe faible. Ajoutez: ${strength.feedback.join(", ")}.`;
      setWorkerCreateError(message);
      error(message);
      return;
    }
    const payload = {
      firstName: workerForm.firstName.trim(),
      lastName: workerForm.lastName.trim(),
      email: normalizedEmail,
      role: normalizedRole,
      password: workerForm.password,
    };
    createWorkerMutation.mutate({
      ...payload,
    });
  };

  const handleDeleteWorker = (userId: string, userName: string) => {
    const confirmed = window.confirm(
      `Supprimer le compte employé "${userName}" ? Cette action est irréversible.`
    );
    if (!confirmed) {
      return;
    }
    deleteWorkerMutation.mutate(userId);
  };

  const handleOpenWorkerEdit = (user: any) => {
    const [firstName = "", ...lastNameParts] = String(user.name || "").split(" ");
    setEditingWorker(user);
    setWorkerEditForm({
      firstName,
      lastName: lastNameParts.join(" "),
      email: user.email || "",
      password: "",
      confirmPassword: "",
      role: "",
    });
    setWorkerEditEmailError("");
  };

  const handleWorkerEditSubmit = () => {
    if (!editingWorker) {
      return;
    }
    if (
      (workerEditForm.password || workerEditForm.confirmPassword) &&
      workerEditForm.password !== workerEditForm.confirmPassword
    ) {
      error("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    const payload: { firstName: string; lastName: string; email: string; role?: string; password?: string } = {
      firstName: workerEditForm.firstName.trim(),
      lastName: workerEditForm.lastName.trim(),
      email: normalizeEmailValue(workerEditForm.email),
    };
    const emailValidationError = getEmailValidationError(payload.email, { required: true });
    setWorkerEditEmailError(emailValidationError);
    if (emailValidationError) {
      error(emailValidationError);
      return;
    }

    const normalizedRole = workerEditForm.role.trim().toLowerCase();
    if (normalizedRole) {
      payload.role = normalizedRole;
    }

    if (workerEditForm.password.trim()) {
      payload.password = workerEditForm.password.trim();
    }

    updateWorkerMutation.mutate({ userId: editingWorker._id, payload });
  };

  if (status === "loading") {
    return <Loading fullScreen text="Chargement..." />;
  }

  if (!session || session.user?.role !== "admin") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Manage Users - Rideaux Bambou Admin" />
      </Head>

      <div className={pageShellClass}>
        {/* Navigation */}
        <AdminNavigation />

        {/* Main Content */}
        <main className={pageMainClass}>
          <div className="mb-6">
            <BackButton href="/admin" />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des Employés</h1>
            </div>

            {/* Worker account creation */}
            <Card className="mx-auto w-full max-w-5xl p-4 sm:p-6">
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                Créer un compte employé
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Cette création est réservée aux employés internes.
              </p>
              <form
                onSubmit={handleCreateWorker}
                autoComplete="off"
                className="grid w-full grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:gap-x-10"
              >
                <Input
                  name="worker_first_name_create"
                  label="Prénom"
                  placeholder="Prénom"
                  value={workerForm.firstName}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  autoComplete="off"
                  className="h-9 py-1.5 text-sm"
                  required
                />
                <Input
                  name="worker_last_name_create"
                  label="Nom"
                  placeholder="Nom"
                  value={workerForm.lastName}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  autoComplete="off"
                  className="h-9 py-1.5 text-sm"
                  required
                />
                <Input
                  type="email"
                  name="worker_email_create"
                  label="Email"
                  placeholder="Email professionnel"
                  value={workerForm.email}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setWorkerForm((prev) => ({ ...prev, email: nextEmail }));
                    if (workerCreateEmailError) {
                      setWorkerCreateEmailError(
                        getEmailValidationError(nextEmail, { required: true })
                      );
                    }
                  }}
                  onBlur={() => {
                    const normalizedEmail = normalizeEmailValue(workerForm.email);
                    setWorkerForm((prev) => ({ ...prev, email: normalizedEmail }));
                    setWorkerCreateEmailError(
                      getEmailValidationError(normalizedEmail, { required: true })
                    );
                  }}
                  error={workerCreateEmailError}
                  autoComplete="off"
                  className="h-9 py-1.5 text-sm"
                  required
                />
                <Input
                  name="worker_role_create"
                  label="Rôle"
                  placeholder="Saisir le rôle"
                  value={workerForm.role}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, role: e.target.value }))}
                  autoComplete="off"
                  className="h-9 py-1.5 text-sm"
                />
                <PasswordInput
                  id="worker_password_create"
                  name="worker_password_create"
                  label="Mot de passe"
                  placeholder="Mot de passe"
                  value={workerForm.password}
                  onChange={(e) => setWorkerForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="h-9 py-1.5 text-sm"
                  required
                />
                <PasswordInput
                  id="worker_confirm_password_create"
                  name="worker_confirm_password_create"
                  label="Confirmer le mot de passe"
                  placeholder="Confirmer le mot de passe"
                  value={workerForm.confirmPassword}
                  onChange={(e) =>
                    setWorkerForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  className="h-9 py-1.5 text-sm"
                  required
                />
                <div className="mt-2 flex justify-end md:col-span-2">
                  <Button
                    type="submit"
                    loading={createWorkerMutation.isPending}
                    disabled={createWorkerMutation.isPending || Boolean(workerCreateEmailError)}
                    className="w-full sm:min-w-[230px] sm:w-auto"
                  >
                    {createWorkerMutation.isPending ? "Création..." : "Créer compte"}
                  </Button>
                </div>
                {workerCreateError && (
                  <p className="md:col-span-2 text-sm font-medium text-red-600 dark:text-red-400">
                    {workerCreateError}
                  </p>
                )}
              </form>
            </Card>

            {/* Users Table */}
            <div className={adminTableShellClassName}>
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-green-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Chargement des utilisateurs...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {workers.map((user: any) => (
                      <div
                        key={`${user._id}-mobile`}
                        className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {user._id.slice(-8)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${roleColors[user.role as keyof typeof roleColors]}`}
                          >
                            {user.role.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Inscrit le {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {user._id !== session.user?.id && (
                            <Button
                              onClick={() => {
                                setEditingUser(user);
                                setNewRole(user.role);
                              }}
                              variant="ghost"
                              size="sm"
                            >
                              Changer le Rôle
                            </Button>
                          )}
                          {user.role === "worker" && (
                            <>
                              <Button onClick={() => handleOpenWorkerEdit(user)} variant="secondary" size="sm">
                                Modifier
                              </Button>
                              <Button
                                onClick={() => handleDeleteWorker(user._id, user.name)}
                                variant="danger"
                                size="sm"
                                disabled={deleteWorkerMutation.isPending}
                                loading={deleteWorkerMutation.isPending}
                              >
                                Supprimer
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <Table className={adminTableRoomySpacingClassName}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Utilisateur</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Rôle</TableHead>
                          <TableHead>Inscrit le</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workers.map((user: any) => (
                          <TableRow key={user._id}>
                            <TableCell>
                              <div className="flex items-center justify-center">
                                <div className="h-10 w-10 flex-shrink-0">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {user.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-4 text-left">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {user.name}
                                  </div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    ID: {user._id.slice(-8)}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${roleColors[user.role as keyof typeof roleColors]}`}
                              >
                                {user.role.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell className="text-gray-500 dark:text-gray-400">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center justify-center gap-2">
                                {user._id !== session.user?.id && (
                                  <Button
                                    onClick={() => {
                                      setEditingUser(user);
                                      setNewRole(user.role);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    Changer le Rôle
                                  </Button>
                                )}
                                {user.role === "worker" && (
                                  <>
                                    <Button
                                      onClick={() => handleOpenWorkerEdit(user)}
                                      variant="secondary"
                                      size="sm"
                                    >
                                      Modifier
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteWorker(user._id, user.name)}
                                      variant="danger"
                                      size="sm"
                                      disabled={deleteWorkerMutation.isPending}
                                      loading={deleteWorkerMutation.isPending}
                                    >
                                      Supprimer
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Pagination */}
              {usersData?.pagination && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      variant="secondary"
                      size="sm"
                    >
                      Précédent
                    </Button>
                    <Button
                      onClick={() =>
                        setCurrentPage(Math.min(usersData.pagination.pages, currentPage + 1))
                      }
                      disabled={currentPage === usersData.pagination.pages}
                      variant="secondary"
                      size="sm"
                    >
                      Suivant
                    </Button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Page <span className="font-medium">{currentPage}</span> sur{" "}
                        <span className="font-medium">
                          {usersData?.pagination?.totalPages || 1}
                        </span>{" "}
                        ({usersData?.pagination?.totalUsers || 0} utilisateurs au total)
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                        <Button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          variant="secondary"
                          size="sm"
                          className="rounded-l-md rounded-r-none"
                        >
                          Précédent
                        </Button>
                        <Button
                          onClick={() =>
                            setCurrentPage(
                              Math.min(usersData?.pagination?.totalPages || 1, currentPage + 1)
                            )
                          }
                          disabled={currentPage === (usersData?.pagination?.totalPages || 1)}
                          variant="secondary"
                          size="sm"
                          className="rounded-l-none rounded-r-md"
                        >
                          Suivant
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </main>

        {/* Role Update Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
            <div className="w-full max-w-md rounded-lg bg-white p-5 dark:bg-gray-800 sm:p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Changer le Rôle de l&apos;Utilisateur
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Utilisateur: {editingUser.name}
                  </label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{editingUser.email}</p>
                </div>

                <div>
                  <label className={formFieldLabelClass}>
                    Nouveau Rôle
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className={formSelectClass}
                  >
                    <option value="user">Utilisateur</option>
                    <option value="worker">Employé</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button onClick={() => setEditingUser(null)} variant="secondary">
                    Annuler
                  </Button>
                  <Button
                    onClick={() => handleRoleUpdate(editingUser._id)}
                    disabled={updateRoleMutation.isPending}
                    loading={updateRoleMutation.isPending}
                    variant="primary"
                  >
                    {updateRoleMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
            <div className="w-full max-w-md rounded-lg bg-white p-5 dark:bg-gray-800 sm:p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Modifier le compte employé
              </h3>

              <div className="space-y-4">
                <Input
                  name="worker_first_name_edit"
                  label="Prénom"
                  placeholder="Prénom"
                  value={workerEditForm.firstName}
                  onChange={(e) =>
                    setWorkerEditForm((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  autoComplete="off"
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <Input
                  name="worker_last_name_edit"
                  label="Nom"
                  placeholder="Nom"
                  value={workerEditForm.lastName}
                  onChange={(e) =>
                    setWorkerEditForm((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  autoComplete="off"
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <Input
                  type="email"
                  name="worker_email_edit"
                  label="Email"
                  placeholder="Email"
                  value={workerEditForm.email}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setWorkerEditForm((prev) => ({ ...prev, email: nextEmail }));
                    if (workerEditEmailError) {
                      setWorkerEditEmailError(getEmailValidationError(nextEmail, { required: true }));
                    }
                  }}
                  onBlur={() => {
                    const normalizedEmail = normalizeEmailValue(workerEditForm.email);
                    setWorkerEditForm((prev) => ({ ...prev, email: normalizedEmail }));
                    setWorkerEditEmailError(
                      getEmailValidationError(normalizedEmail, { required: true })
                    );
                  }}
                  error={workerEditEmailError}
                  autoComplete="off"
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <Input
                  name="worker_role_edit"
                  label="Rôle"
                  placeholder="Saisir le rôle"
                  value={workerEditForm.role}
                  onChange={(e) =>
                    setWorkerEditForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                  autoComplete="off"
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <PasswordInput
                  id="worker_password_edit"
                  name="worker_password_edit"
                  label="Mot de passe"
                  placeholder="Nouveau mot de passe (optionnel)"
                  value={workerEditForm.password}
                  onChange={(e) =>
                    setWorkerEditForm((prev) => ({ ...prev, password: e.target.value }))
                  }
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <PasswordInput
                  id="worker_confirm_password_edit"
                  name="worker_confirm_password_edit"
                  label="Confirmer le mot de passe"
                  placeholder="Confirmer le mot de passe"
                  value={workerEditForm.confirmPassword}
                  onChange={(e) =>
                    setWorkerEditForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  className="h-9 max-w-sm py-1.5 text-sm"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Si le mot de passe est vide, il ne sera pas modifié.
                </p>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button onClick={() => setEditingWorker(null)} variant="secondary">
                    Annuler
                  </Button>
                  <Button
                    onClick={handleWorkerEditSubmit}
                    disabled={updateWorkerMutation.isPending || Boolean(workerEditEmailError)}
                    loading={updateWorkerMutation.isPending}
                  >
                    {updateWorkerMutation.isPending ? "Mise à jour..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) =>
  requireAdminPage(context, "Gestion des Employés - Rideaux Bambou Admin");
