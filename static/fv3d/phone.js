// FinVeille — téléphone ou non : la détection partagée par le décor, les maquettes et les animations.
//
// Un téléphone, c'est un écran tactile (pointeur grossier) ou un écran étroit. Sur ordinateur (pointeur fin, 760 px et
// plus), rien ne change : tout l'allègement du rendu 3D passe par cette fonction. Elle est relue à chaque appel : une
// fenêtre redimensionnée ou une tablette qui pivote change de catégorie sans recharger la page.

export const isPhone = () => window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
