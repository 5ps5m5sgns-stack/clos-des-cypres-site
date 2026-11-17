/* ===== Réglages modifiables sans toucher à la scène =====
   titre, sousTitre, mention : textes du cartouche.
   rotationAccueil : la vue tourne doucement jusqu'au premier geste du visiteur.
   contact : lien du bouton de la fiche ({n} = numéro du lot). retour : lien affiché quand la page est ouverte seule.
   sol : image du plan posée au sol (grand écran / petit écran).
   lots : surfaces en m² (plan de composition PA4 du 3 avril 2026). Champs facultatifs par lot :
          statut: "Disponible" | "Réservé" | "Vendu",  prix: "… €",  note: "texte libre".
   afficherJardins : true pour afficher dans la fiche la surface du jardin attenant des lots 4 et 5 (champ jardin). */
window.LOTISSEMENT = {
  titre: "Le Clos des Cyprès",
  sousTitre: "Biver (Gardanne) · 8 terrains à bâtir de 500 à 1\u00a0133\u00a0m²",
  rotationAccueil: true,
  contact: "/contact?lot={n}#contact-form",
  sol: {
    grand: "/images-optimized/vue3d-sol-v2-3311.webp",
    petit: "/images-optimized/vue3d-sol-v2-2048.webp"
  },
  afficherJardins: false,
  lots: {
    1: { surface: 1133 },
    2: { surface: 861 },
    3: { surface: 703 },
    4: { surface: 500, jardin: 450 },
    5: { surface: 637, jardin: 425 },
    6: { surface: 704 },
    7: { surface: 782 },
    8: { surface: 600 }
  }
};
