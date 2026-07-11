import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

import Navigation from "../../components/Navigation";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Loading from "../../components/ui/Loading";
import { useToast } from "../../contexts/ToastContext";
import { getEmailValidationError, normalizeEmailValue } from "../../lib/email-validation";
import { formFieldLabelClass, formSelectClass, formSelectDisabledClass } from "../../lib/form-field-styles";
import { getPhoneValidationError, normalizePhoneValue } from "../../lib/phone-validation";
import {
  getCitiesForGovernorate,
  resolveGovernorateName,
} from "../../lib/tunisia-locations";

interface UserSettingsProps {
  title: string;
}

// All 24 governorates of Tunisia
const TUNISIAN_GOVERNORATES = [
  "Ariana",
  "Béja",
  "Ben Arous",
  "Bizerte",
  "Gabès",
  "Gafsa",
  "Jendouba",
  "Kairouan",
  "Kasserine",
  "Kébili",
  "Kef",
  "Mahdia",
  "Manouba",
  "Médenine",
  "Monastir",
  "Nabeul",
  "Sfax",
  "Sidi Bouzid",
  "Siliana",
  "Sousse",
  "Tataouine",
  "Tozeur",
  "Tunis",
  "Zaghouan",
];

// Mapping of governorates to their delegations
const GOVERNORATE_DELEGATIONS: Record<string, string[]> = {
  Ariana: [
    "La Soukra",
    "Raoued",
    "Mnihla",
    "Ariana Ville",
    "Ettadhamen",
    "Kalâat el-Andalous",
    "Sidi Thabet",
  ],
  "Ben Arous": [
    "El Mourouj",
    "Fouchana",
    "Mohamedia",
    "Mornag",
    "Radès",
    "Medina Jedida",
    "Bou Mhel el-Bassatine",
    "Hammam Lif",
    "Ezzahra",
    "Hammam Chott",
    "Ben Arous",
    "Mégrine",
  ],
  Béja: [
    "Béja Nord",
    "Nefza",
    "Medjez el-Bab",
    "Béja Sud",
    "Testour",
    "Téboursouk",
    "Amdoun",
    "Goubellat",
    "Thibar",
  ],
  Bizerte: [
    "Bizerte Nord",
    "Bizerte Sud",
    "Ras Jebel",
    "Menzel Bourguiba",
    "Menzel Jemil",
    "Mateur",
    "Sejnane",
    "El Alia",
    "Joumine",
    "Ghezala",
    "Zarzouna",
    "Utique",
    "Ghar El Melh",
    "Tinja",
  ],
  Gabès: [
    "Gabès Sud",
    "El Hamma",
    "Mareth-Dkhila",
    "Gabès Médina",
    "Gabès Ouest",
    "Ghannouch",
    "El Hamma Ouest",
    "Oudhref",
    "Nouvelle Matmata",
    "Métouia",
    "Menzel El Habib",
    "Toujane",
    "Matmata",
  ],
  Gafsa: [
    "Gafsa Sud",
    "Métlaoui",
    "El Ksar",
    "Moularès",
    "Redeyef",
    "Sened",
    "El Guettar",
    "Mdhilla",
    "Zannouch",
    "Belkhir",
    "Sidi Aïch",
    "Gafsa Nord",
    "Sidi Boubaker",
  ],
  Jendouba: [
    "Jendouba",
    "Ghardimaou",
    "Tabarka",
    "Fernana",
    "Jendouba Nord",
    "Bou Salem",
    "Balta-Bou Aouane",
    "Aïn Draham",
    "Oued Meliz",
  ],
  Kairouan: [
    "Kairouan Nord",
    "Kairouan Sud",
    "Bou Hajla",
    "Sbikha",
    "Haffouz",
    "Hajeb El Ayoun",
    "Chebika",
    "El Alâa",
    "Echrarda",
    "Oueslatia",
    "Nasrallah",
    "Menzel Mehiri",
    "Aïn Djeloula",
  ],
  Kasserine: [
    "Sbeïtla",
    "Kasserine Nord",
    "Fériana",
    "Foussana",
    "Sbiba",
    "Thala",
    "Majel Bel Abbès",
    "Kasserine Sud",
    "Ezzouhour",
    "Hassi El Ferid",
    "El Ayoun",
    "Jedelienne",
    "Haïdra",
  ],
  Kébili: [
    "Kébili Nord",
    "Kébili Sud",
    "Douz Nord",
    "Souk Lahad",
    "Douz Sud",
    "Faouar",
    "Rjim Maatoug",
  ],
  Kef: [
    "Kef Est",
    "Kef Ouest",
    "Tajerouine",
    "Dahmani",
    "Sers",
    "Nebeur",
    "Sakiet Sidi Youssef",
    "El Ksour",
    "Kalaat Senan",
    "Jérissa",
    "Touiref",
    "Kalâat Khasba",
  ],
  Mahdia: [
    "Mahdia",
    "Essouassi",
    "El Jem",
    "Sidi Alouane",
    "Ksour Essef",
    "Bou Merdes",
    "Chebba",
    "Chorbane",
    "Ouled Chamekh",
    "Melloulèche",
    "El Bradâa",
    "Hebira",
    "Rejiche",
  ],
  Manouba: [
    "Douar Hicher",
    "Oued Ellil",
    "La Manouba",
    "Djedeida",
    "Tebourba",
    "Mornaguia",
    "Borj El Amri",
    "El Batan",
  ],
  Médenine: [
    "Ben Gardane",
    "Djerba - Houmt Souk",
    "Zarzis",
    "Djerba - Midoun",
    "Médenine Nord",
    "Médenine Sud",
    "Sidi Makhlouf",
    "Beni Khedache",
    "Djerba - Ajim",
  ],
  Monastir: [
    "Monastir",
    "Moknine",
    "Jemmal",
    "Ksar Hellal",
    "Ksibet el-Médiouni",
    "Téboulba",
    "Bembla",
    "Sahline",
    "Zéramdine",
    "Sayada-Lamta-Bou Hajar",
    "Ouerdanine",
    "Bekalta",
    "Beni Hassen",
  ],
  Nabeul: [
    "Hammam Ghezèze",
    "Grombalia",
    "Korba",
    "Nabeul",
    "Soliman",
    "Menzel Temime",
    "Kélibia",
    "Dar Chaâbane El Fehri",
    "Béni Khiar",
    "El Haouaria",
    "Béni Khalled",
    "Menzel Bouzelfa",
    "Bou Argoub",
    "El Mida",
    "Takelsa",
  ],
  Sfax: [
    "Sfax Sud",
    "Sakiet Eddaïer",
    "Sfax Ouest",
    "Sfax Ville",
    "Sakiet Ezzit",
    "Thyna",
    "Jebiniana",
    "El Hencha",
    "Bir Ali Ben Khalifa",
    "Agareb",
    "Menzel Chaker",
    "Skhira",
    "El Amra",
    "Mahrès",
    "Graïba",
    "Kerkennah",
  ],
  "Sidi Bouzid": [
    "Sidi Bouzid Ouest",
    "Sidi Bouzid Est",
    "Regueb",
    "Jilma",
    "Bir El Hafey",
    "Sidi Ali Ben Aoun",
    "Menzel Bouzaiane",
    "Essaïda",
    "Mezzouna",
    "Souk Jedid",
    "Cebbala Ouled Asker",
    "Meknassy",
    "Ouled Haffouz",
    "Hichria",
  ],
  Siliana: [
    "Siliana Sud",
    "Siliana Nord",
    "Makthar",
    "Rouhia",
    "El Krib",
    "Bou Arada",
    "Gaâfour",
    "Kesra",
    "Sidi Bou Rouis",
    "Bargou",
    "El Aroussa",
  ],
  Sousse: [
    "Sousse Jawhara",
    "M'saken",
    "Sousse Riadh",
    "Kalâa Kebira",
    "Enfida",
    "Sousse Sidi Abdelhamid",
    "Zaouiet Ksibet Thrayet",
    "Hammam Sousse",
    "Kalâa Seghira",
    "Akouda",
    "Bouficha",
    "Sousse Médina",
    "Sidi Bou Ali",
    "Kondar",
    "Sidi El Hani",
    "Hergla",
  ],
  Tataouine: [
    "Tataouine Nord",
    "Tataouine Sud",
    "Ghomrassen",
    "Bir Lahmar",
    "Remada",
    "Beni Mhira",
    "Smâr",
    "Dehiba",
  ],
  Tozeur: [
    "Tozeur",
    "Degache",
    "Nefta",
    "El Hamma du Jérid",
    "Tameghza",
    "Hazoua",
  ],
  Tunis: [
    "Sidi Hassine",
    "Hraïria",
    "La Marsa",
    "Le Kram",
    "El Kabaria",
    "Le Bardo",
    "El Omrane supérieur",
    "La Goulette",
    "El Menzah",
    "El Omrane",
    "Ezzouhour",
    "Cité El Khadra",
    "Bab El Bhar",
    "El Ouardia",
    "Séjoumi",
    "Bab Souika",
    "Sidi El Béchir",
    "Djebel Jelloud",
    "Carthage",
    "Ettahrir",
    "Médina",
  ],
  Zaghouan: [
    "El Fahs",
    "Zaghouan",
    "Nadhour",
    "Zriba",
    "Bir Mcherga",
    "Saouaf",
  ],
};

// Mapping of governorates to all their cities and communes (complete list from official data)
const GOVERNORATE_CITIES: Record<string, string[]> = {
  Ariana: [
    "La Soukra",
    "Ariana",
    "Raoued",
    "Mnihla",
    "Ettadhamen",
    "Kalâat el-Andalous",
    "Sidi Thabet",
  ],
  "Ben Arous": [
    "El Mourouj",
    "Ben Arous",
    "Mohamedia",
    "Radès",
    "Fouchana",
    "Bou Mhel el-Bassatine",
    "Ezzahra",
    "Hammam Lif",
    "Hammam Chott",
    "Mégrine",
    "Mornag",
    "Naassen",
    "Khalidia",
  ],
  Béja: [
    "Béja",
    "Medjez el-Bab",
    "Testour",
    "Nefza",
    "Téboursouk",
    "Thibar",
    "Ouchtata-Jmila",
    "El Maâgoula",
    "Sidi Ismaïl",
    "Slouguia",
    "Amdoun",
    "Goubellat",
  ],
  Bizerte: [
    "Bizerte",
    "Menzel Bourguiba",
    "Mateur",
    "Joumine",
    "Ras Jebel",
    "Ghezala",
    "Tinja",
    "Utique",
    "Menzel Jemil",
    "Menzel Abderrahmane",
    "El Alia",
    "Ghar El Melh",
    "Sejnane",
    "El Hachachna",
    "Metline",
    "Raf Raf",
    "Aousja",
  ],
  Gabès: [
    "Gabès",
    "El Hamma",
    "Ghannouch",
    "Mareth",
    "Matmata",
    "Nouvelle Matmata",
    "Oudhref",
    "Chenini Nahal",
    "Menzel El Habib",
    "Kettana",
    "Dkhilet Toujane",
    "Zarat",
    "Métouia",
    "Habib Thameur Bouatouch",
    "Teboulbou",
  ],
  Gafsa: [
    "Gafsa",
    "Métlaoui",
    "El Guettar",
    "El Ksar",
    "Mdhilla",
    "Redeyef",
    "Sened",
    "Sidi Aïch",
    "Belkhir",
    "Moularès",
    "Lela",
    "Sidi Boubaker",
    "Zannouch",
  ],
  Jendouba: [
    "Jendouba",
    "Aïn Draham",
    "Balta-Bou Aouane",
    "Bou Salem",
    "Fernana",
    "Ghardimaou",
    "Oued Meliz",
    "Tabarka",
    "Beni M'Tir",
    "Jouaouda",
    "Aïn Sobh-Nadhour",
    "Kalaa-Maaden-Farksan",
    "Souk Sebt",
    "Khmairia",
  ],
  Kairouan: [
    "Kairouan",
    "Bou Hajla",
    "Chebika",
    "El Ala",
    "Haffouz",
    "Hajeb El Ayoun",
    "Nasrallah",
    "Oueslatia",
    "Sbikha",
    "Sisseb-Driaat",
    "Raqqada",
    "Chaouachi",
    "Aïn El Beïdha",
    "Jhina",
    "Chraitia-Ksour",
    "Aïn Djeloula",
    "Echrarda",
    "Menzel Mehiri",
    "Menzel Fersi",
    "El Alâa",
  ],
  Kasserine: [
    "Kasserine",
    "Fériana",
    "Foussana",
    "Haïdra",
    "Jedelienne",
    "Majel Bel Abbès",
    "Sbeïtla",
    "Sbiba",
    "Thala",
    "Ennour",
    "Chrayaa-Machrek Chams",
    "Ezzouhour",
    "Khmouda",
    "Rakhmat",
    "Bouzguem",
    "Aïn Khmaissia",
    "Hassi El Ferid",
    "El Ayoun",
    "Thélepte",
  ],
  Kébili: [
    "Kébili",
    "Douz",
    "Faouar",
    "Souk Lahad",
    "Bechli-Blidet-Jerssin",
    "El Golâa",
    "Jemna",
    "Rjim Maatoug",
  ],
  Kef: [
    "Le Kef",
    "Dahmani",
    "Jérissa",
    "El Ksour",
    "Kalaat Senan",
    "Kalâat Khasba",
    "Nebeur",
    "Sers",
    "Tajerouine",
    "Touiref",
    "Sakiet Sidi Youssef",
    "Zaafrana-Dir Kef",
    "Le Sers",
    "El Marja",
    "Bohra",
    "Menzel Salem",
  ],
  Mahdia: [
    "Mahdia",
    "Bou Merdes",
    "Chebba",
    "Chorbane",
    "El Jem",
    "Essouassi",
    "Ksour Essef",
    "Melloulèche",
    "Sidi Alouane",
    "Ouled Chamekh",
    "Sidi Zid-Awled Moulahem",
    "Hkaima",
    "Rejiche",
    "Hebira",
    "Kerker",
    "El Bradâa",
    "Tlelsa",
    "Zelba",
  ],
  Manouba: [
    "La Manouba",
    "Douar Hicher",
    "Oued Ellil",
    "Borj El Amri",
    "Djedeida",
    "Tebourba",
    "Den Den",
    "Mornaguia",
    "El Bassatine",
    "El Batan",
  ],
  Médenine: [
    "Médenine",
    "Ben Gardane",
    "Djerba - Houmt Souk",
    "Djerba - Midoun",
    "Zarzis",
    "Beni Khedache",
    "Djerba - Ajim",
    "Sidi Makhlouf",
    "Zarzis Nord",
    "Boughrara",
  ],
  Monastir: [
    "Monastir",
    "Jemmal",
    "Ksar Hellal",
    "Moknine",
    "Téboulba",
    "Bekalta",
    "Bembla",
    "Bembla-Mnara",
    "Beni Hassen",
    "Ouerdanine",
    "Sahline Moôtmar",
    "Sayada",
    "Zéramdine",
    "Ksibet el-Médiouni",
    "Menzel Hayet",
    "Touza",
    "Zaouiet Kontoch",
    "Amiret Touazra",
    "Bouhjar",
    "Lamta",
    "Amiret El Fhoul",
    "El Ghnada",
    "El Masdour-Menzel Harb",
    "Sidi Bennour",
    "Cherahil",
    "Khniss",
    "Menzel Ennour",
    "Menzel Kamel",
    "Sidi Ameur-Mesjed-Aïssa",
    "Amiret Hajjaj",
    "Sidi Jedidi",
    "Bennane-Bodheur",
  ],
  Nabeul: [
    "Nabeul",
    "Hammamet",
    "Kélibia",
    "Soliman",
    "Korba",
    "Menzel Temime",
    "Béni Khalled",
    "Béni Khiar",
    "Dar Chaâbane",
    "Grombalia",
    "Menzel Bouzelfa",
    "Takelsa",
    "Bou Argoub",
    "El Haouaria",
    "El Mida",
    "Hammam Ghezèze",
    "Menzel Horr",
    "Fondouk Jedid-Seltene",
    "Chrifet-Boucharray",
    "Tazougrane-Boukrim-Zaouiet El Mgaies",
    "Somâa",
    "Azmour",
    "Dar Allouch",
    "Korbous",
    "Tazarka",
    "El Maâmoura",
    "Zaouiet Djedidi",
  ],
  Sfax: [
    "Sfax",
    "Sakiet Ezzit",
    "Sakiet Eddaïer",
    "Sakiet Eddaier",
    "El Aïn",
    "Gremda",
    "Ouabed Khazanet",
    "Thyna",
    "El Amra",
    "El Hencha",
    "Agareb",
    "Graïba",
    "Jebiniana",
    "Kerkennah",
    "Mahrès",
    "Menzel Chaker",
    "Skhira",
    "Chihia",
    "Ennasr",
    "Nadhour-Sidi Ali Ben Abed",
    "Hadjeb",
    "Lessouda",
    "Hazeg Ellouza",
    "Aachech-Aouadna-Boujarbou-Majel Draj",
    "Bir Ali Ben Khalifa",
  ],
  "Sidi Bouzid": [
    "Sidi Bouzid",
    "Souk Jedid",
    "Essaïda",
    "Faiedh Bennour",
    "Regueb",
    "Meknassy",
    "Menzel Bouzaiane",
    "Mezzouna",
    "Ouled Haffouz",
    "Sidi Ali Ben Aoun",
    "Bir El Hafey",
    "Cebbala Ouled Asker",
    "Jilma",
    "Mansoura",
    "Baten Ghzal",
    "Rahal",
  ],
  Siliana: [
    "Siliana",
    "Bargou",
    "Bou Arada",
    "El Aroussa",
    "El Krib",
    "Gaâfour",
    "Kesra",
    "Makthar",
    "Rouhia",
    "Sidi Morched",
    "Hbabsa",
    "Sidi Bou Rouis",
  ],
  Sousse: [
    "Sousse",
    "Kalâa Kebira",
    "Kalâa Seghira",
    "Hammam Sousse",
    "Akouda",
    "Bouficha",
    "Enfida",
    "Enfidha",
    "Hergla",
    "Kondar",
    "M'saken",
    "Sidi Bou Ali",
    "Sidi El Hani",
    "Ezzouhour",
    "Grimet-Hicher",
    "Messaadine",
    "Ksibet Thrayet",
    "Zaouiet Sousse",
    "Chott Meriem",
  ],
  Tataouine: [
    "Tataouine",
    "Bir Lahmar",
    "Dehiba",
    "Ghomrassen",
    "Remada",
    "Smâr",
    "Tataouine Sud",
  ],
  Tozeur: [
    "Tozeur",
    "Degache",
    "Hazoua",
    "Nefta",
    "El Hamma du Jérid",
    "Tamerza",
  ],
  Tunis: [
    "Tunis",
    "Sidi Hassine",
    "La Marsa",
    "Le Kram",
    "Le Bardo",
    "Carthage",
    "La Goulette",
    "Sidi Bou Saïd",
  ],
  Zaghouan: [
    "Zaghouan",
    "El Fahs",
    "Bir Mcherga",
    "Nadhour",
    "Saouaf",
    "Zriba",
    "Djebel Oust",
    "El Amaiem",
  ],
};

export default function UserSettings({ title }: UserSettingsProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    name: "",
    email: "",
    phone: "",
    address: "",
    delegation: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/connexion?callbackUrl=/profile/settings");
      return;
    }
    if (session.user?.role === "worker") {
      router.push("/");
    }
  }, [session, status, router]);

  // Update form data when session loads
  useEffect(() => {
    if (session?.user) {
      // Use firstName and lastName directly
      const firstName = session.user.firstName || "";
      const lastName = session.user.lastName || "";

      setFormData({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email: session.user.email || "",
        phone: "",
        address: "",
        delegation: "",
        city: "",
        state: "",
        postalCode: "",
      });
    }
  }, [session]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        throw new Error("Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      success("Profil mis à jour avec succès.");
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : "Erreur inconnue";
      error(`Erreur: ${message}`);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const nextValue = name === "phone" ? normalizePhoneValue(value) : value;
    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: nextValue,
      };
      // Reset delegation and city when governorate changes
      if (name === "state") {
        newData.delegation = "";
        newData.city = "";
        newData.state = resolveGovernorateName(nextValue);
      }
      // Reset city when delegation changes
      if (name === "delegation") {
        newData.city = "";
      }
      return newData;
    });

    if (name === "email" && emailError) {
      setEmailError(getEmailValidationError(nextValue, { required: true }));
    }
    if (name === "phone" && phoneError) {
      setPhoneError(getPhoneValidationError(nextValue));
    }
  };

  // Get delegations for the selected governorate
  const availableDelegations = formData.state ? GOVERNORATE_DELEGATIONS[formData.state] || [] : [];
  // Get cities for the selected governorate
  const availableCities = formData.state ? getCitiesForGovernorate(formData.state) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmailValue(formData.email);
    const normalizedPhone = normalizePhoneValue(formData.phone);
    const nextEmailError = getEmailValidationError(normalizedEmail, { required: true });
    const nextPhoneError = getPhoneValidationError(normalizedPhone);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    if (nextEmailError || nextPhoneError) {
      return;
    }
    // Combine firstName and lastName into full name
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const dataToSubmit = {
      ...formData,
      email: normalizedEmail,
      phone: normalizedPhone,
      name: fullName,
    };
    setFormData((prev) => ({ ...prev, email: normalizedEmail, phone: normalizedPhone }));
    updateProfileMutation.mutate(dataToSubmit);
  };

  if (status === "loading") {
    return <Loading fullScreen text="Loading..." />;
  }

  if (!session) {
    return null;
  }

  if (session.user?.role === "worker") {
    return null;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Paramètres Utilisateur - Rideaux Bambou" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Paramètres du Compte
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Gérez vos informations de compte et préférences
              </p>
            </div>

            {/* Profile Form */}
            <Card className="p-8">
              <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
                Informations Personnelles
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className={formFieldLabelClass}>
                      Prénom
                    </label>
                    <Input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Nom
                    </label>
                    <Input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Adresse Email
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      onBlur={() => {
                        const normalizedEmail = normalizeEmailValue(formData.email);
                        setFormData((prev) => ({ ...prev, email: normalizedEmail }));
                        setEmailError(getEmailValidationError(normalizedEmail, { required: true }));
                      }}
                      error={emailError}
                      required
                    />
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Numéro de Téléphone
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      onBlur={() => setPhoneError(getPhoneValidationError(formData.phone))}
                      inputMode="numeric"
                      maxLength={8}
                      pattern="[0-9]*"
                      error={phoneError}
                    />
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Gouvernorat
                    </label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className={formSelectClass}
                    >
                      <option value="">Sélectionnez un gouvernorat</option>
                      {TUNISIAN_GOVERNORATES.map((governorate) => (
                        <option key={governorate} value={governorate}>
                          {governorate}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Délégation
                    </label>
                    <select
                      name="delegation"
                      value={formData.delegation}
                      onChange={handleInputChange}
                      disabled={!formData.state}
                      className={formSelectDisabledClass}
                    >
                      <option value="">
                        {formData.state ? "Sélectionnez une délégation" : "Sélectionnez d'abord un gouvernorat"}
                      </option>
                      {availableDelegations.map((delegation) => (
                        <option key={delegation} value={delegation}>
                          {delegation}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Ville
                    </label>
                    <select
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      disabled={!formData.state || availableCities.length === 0}
                      className={formSelectDisabledClass}
                    >
                      <option value="">
                        {formData.state ? "Sélectionnez une ville" : "Sélectionnez d'abord un gouvernorat"}
                      </option>
                      {availableCities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={formFieldLabelClass}>
                      Code Postal
                    </label>
                    <div className="max-w-xs">
                      <Input
                        type="text"
                        name="postalCode"
                        value={formData.postalCode}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={formFieldLabelClass}>
                    Adresse
                  </label>
                  <div className="max-w-2xl">
                    <Input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={updateProfileMutation.isPending}
                    disabled={updateProfileMutation.isPending || Boolean(emailError) || Boolean(phoneError)}
                    className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  >
                    Sauvegarder les Modifications
                  </Button>
                </div>
              </form>
            </Card>

            {/* Account Actions */}
            <Card className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Actions du Compte
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Gérez la sécurité et les paramètres avancés de votre compte
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Change Password Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-blue-100 dark:border-gray-700 dark:from-gray-800 dark:to-gray-700 dark:hover:shadow-gray-900"
                >
                  <div className="absolute right-4 top-4">
                    <div className="rounded-full bg-blue-100 p-3 group-hover:bg-blue-200 dark:bg-blue-900 dark:group-hover:bg-blue-800">
                      <svg
                        className="h-6 w-6 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div className="pr-20">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Changer le Mot de Passe
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Mettez à jour votre mot de passe pour sécuriser votre compte
                    </p>
                  </div>

                  <div className="mt-6">
                    <Button
                      variant="secondary"
                      className="w-full bg-white text-gray-900 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    >
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Modifier le Mot de Passe
                    </Button>
                  </div>
                </motion.div>

              </div>

              {/* Additional Security Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-8 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.726-1.36 3.491 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Information de Sécurité
                    </h4>
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      Ces actions affectent la sécurité de votre compte. Assurez-vous de bien
                      comprendre les conséquences avant de procéder.
                    </p>
                  </div>
                </div>
              </motion.div>
            </Card>
          </motion.div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {
      title: "Paramètres - Rideaux Bambou",
    },
  };
};
