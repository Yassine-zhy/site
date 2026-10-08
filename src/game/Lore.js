// Le lore d'Aetheria : la Couronne d'Aube, la Nuit du Bris, les cinq seigneurs et leurs Éclats.
// Tout le texte de l'histoire vit ici (prologue, actes, sceaux de Brume, stèles de mémoire,
// chroniques des seigneurs) ; Story.js le met en scène.
//
// Le mythe, en bref :
//   Au commencement, la Nuit couvrait la mer. L'Aube descendit et se posa sur le plus haut pic
//   sous la forme d'une couronne de lumière. Ses cinq rayons donnèrent aux terres leurs dons
//   (Souveraineté, Endurance, Mémoire, Vie, Passage) ; chaque âme naissait avec une Lueur qui,
//   à la mort, retournait à l'Aube. Solenn, premier Roi de l'Aube, refusa de rendre la sienne :
//   il posa la Couronne sur son front, et elle se brisa (la Nuit du Bris). Les cinq Éclats
//   tombèrent dans le cœur de leurs gardiens et en firent les seigneurs de la Brume. Depuis cent
//   ans, la Nuit remonte du Puits d'Ombre, les Phares s'éteignent, les morts ne trouvent plus le
//   chemin et les enfants naissent Sans-Lueur. Le héros est un Sans-Lueur tombé dans la Brume,
//   que le Cœur de Lumière a rappelé : un Porte-Aube.

export const PROLOGUE = [
  'Au commencement, la Nuit recouvrait la mer.',
  'Puis l’Aube descendit sur Aetheria, et se posa sur la plus haute cime comme une couronne : la Couronne d’Aube.',
  'Ses cinq rayons firent les terres et leurs dons : la Souveraineté, l’Endurance, la Mémoire, la Vie et le Passage.',
  'Chaque âme naissait avec une Lueur. Et chaque Lueur, à la mort, retournait à l’Aube.',
  'Mais Solenn, premier Roi de l’Aube, craignit de rendre la sienne. Il gravit le Pic, et posa la Couronne sur son propre front.',
  'La Couronne ne se porte pas. Elle se brisa. Ce fut la Nuit du Bris.',
  'Ses cinq Éclats tombèrent dans le cœur de leurs gardiens, et les changèrent en seigneurs de la Brume.',
  'Depuis cent ans, la Brume monte du Puits d’Ombre. Les Phares s’éteignent. Les morts ne trouvent plus le chemin. Les enfants naissent Sans-Lueur.',
  'Toi, Sans-Lueur, tu es tombé dans la Brume… et le Cœur de Lumière t’a rappelé.',
  'Relève-toi, Porte-Aube. Rallume les Phares. Reprends les Éclats. Reforge la Couronne.',
];

// Actes : chaque acte commence quand sa première quête principale est proposée.
export const ACTS = [
  { n: 0, from: 'm1', title: 'Prologue', name: 'Le Réveil', summary: 'Rappelé par le Cœur de Lumière, vous vous éveillez à Havrelumière, dernier refuge de l’Aube. Maëlis, la dernière prêtresse, vous attend.' },
  { n: 1, from: 'm2', title: 'Acte I', name: 'Les Braises', summary: 'La Brume assiège Havrelumière. Rallumez les premiers Phares, purgez le Bois-Murmure et fouillez les Cendres, ruines de Solaria, la cité du Roi. Les stèles y gardent la mémoire de la Nuit du Bris.' },
  { n: 2, from: 'm8', title: 'Acte II', name: 'Le Roi Sans Lumière', summary: 'Solenn, le premier Roi, attend sur le Pic du Silence, l’Éclat de Souveraineté enfoncé dans le cœur. Tant qu’il règne, la Brume ferme les terres lointaines.' },
  { n: 3, from: 'm9', title: 'Acte III', name: 'L’Ambre et le Givre', summary: 'La Brume a reculé à l’est. Dans les Terres d’Ambre, Oramund le Colosse garde l’Éclat d’Endurance ; au nord, sur le Givrecroc, Aëlys la Reine de Givre garde l’Éclat de Mémoire.' },
  { n: 4, from: 'm16', title: 'Acte IV', name: 'La Sève et les Tombes', summary: 'Au sud, Sylvaën l’Arbre-qui-marche pourrit sous la sève noire ; à l’ouest, Morne le Passeur enterre les vivants. Les deux derniers Éclats vous attendent.' },
  { n: 5, from: 'm15', title: 'Acte V', name: 'L’Aube Éternelle', summary: 'Les cinq Éclats sont repris. Reforgez la Couronne au Cœur de Lumière, puis descendez avec vos compagnons dans la Citadelle des Ombres, au-dessus du Puits d’Ombre, pour refermer la Nuit.' },
];

// Les cinq Éclats de la Couronne (repris en terrassant leur seigneur)
export const SHARDS = {
  souverainete: { boss: 'roi', name: 'Éclat de Souveraineté', color: '#ffd36b', desc: 'Premier rayon de la Couronne d’Aube. Il faisait des rois des bergers, et des bergers des rois. Solenn le garda si serré contre son cœur qu’il en oublia de battre.' },
  endurance: { boss: 'colosse', name: 'Éclat d’Endurance', color: '#ffb050', desc: 'Rayon chaud comme l’ambre au soleil. Les mineurs l’enchâssèrent dans le cœur d’Oramund pour qu’il ne se lasse jamais de veiller. Il ne s’est jamais lassé, pas même de haïr.' },
  memoire: { boss: 'reine', name: 'Éclat de Mémoire', color: '#9fe0ff', desc: 'Rayon froid et clair où dorment tous les souvenirs d’Aetheria. Aëlys le gela pour garder intact le visage de son frère d’avant la Nuit.' },
  vie: { boss: 'gardien', name: 'Éclat de Vie', color: '#7dff8a', desc: 'Rayon vert qui faisait monter la sève et tomber la pluie. Sylvaën le but jusqu’à la dernière goutte quand la sève noire vint, et devint ce qu’il combattait.' },
  passage: { boss: 'fossoyeur', name: 'Éclat de Passage', color: '#c9b8ff', desc: 'Rayon pâle qui montrait aux Lueurs des morts le chemin du retour. Sans lui, Morne n’a plus su où les conduire. Alors il a creusé.' },
};
export const SHARD_OF = Object.fromEntries(Object.entries(SHARDS).map(([k, s]) => [s.boss, k]));

// Les cinq seigneurs : leur vrai nom et leur histoire (révélée dans les Chroniques à leur chute)
export const LORDS = {
  roi: { name: 'Le Roi Sans Lumière', true: 'Solenn, premier Roi de l’Aube', lore: 'Il fut le plus aimé des rois. Il bâtit Solaria au pied du Pic et les Phares sur chaque colline. Mais la peur de rendre sa Lueur grandit en lui comme une ombre au soir, et une nuit il gravit le Pic pour porter la Couronne. Elle se brisa sur son front. Il règne depuis sur un trône vide, dans un silence qu’il prend pour la paix.', fall: 'La Lueur de Solenn retourne enfin à l’Aube. Le Pic se souvient de son vrai nom.' },
  colosse: { name: 'Le Colosse d’Ambre', true: 'Oramund, le Porteur d’Ambre', lore: 'Les mineurs des Terres d’Ambre le taillèrent dans un seul bloc de résine fossile et lui donnèrent un cœur : l’Éclat d’Endurance. Il gardait le Cirque où l’on venait prier le soleil. Quand la Couronne se brisa, personne ne vint plus lui dire qui protéger. Il protège donc le Cirque contre tous.', fall: 'Le cœur d’Oramund cesse de battre. Pour la première fois depuis cent ans, il se repose.' },
  reine: { name: 'La Reine de Givre', true: 'Aëlys des Neiges, sœur de Solenn', lore: 'Sœur cadette du Roi, elle aimait les cimes et les chants. La Nuit du Bris, elle sentit son frère se perdre. Pour ne jamais oublier son visage d’avant, elle gela son propre cœur autour de l’Éclat de Mémoire. Depuis, elle chante la même chanson, et la glace monte avec chaque couplet.', fall: 'La chanson s’arrête. Dans le silence, Aëlys se souvient enfin d’avoir pardonné.' },
  gardien: { name: 'Le Gardien Sylvestre', true: 'Sylvaën, l’Arbre-qui-marche', lore: 'Né d’une graine tombée de la Couronne, il gardait la Canopée et faisait pleuvoir sur les champs. Quand la sève noire de la Brume monta par ses racines, il but l’Éclat de Vie pour la combattre de l’intérieur. Il perdit. Ce qui marche aujourd’hui sur le Mont Feuillu n’est plus tout à fait un arbre.', fall: 'Les racines se desserrent. Sur le Mont Feuillu, une pousse verte perce la mousse noire.' },
  fossoyeur: { name: 'Le Fossoyeur', true: 'Morne, le Passeur des Lueurs', lore: 'Il guidait les Lueurs des morts sur le chemin pâle qui menait à l’Aube. Quand le chemin s’effaça, les morts restèrent sur ses bras. Il les enterra, un à un, puis par milliers. Un jour, il comprit que la Brume finirait par prendre aussi les vivants, et se mit à leur creuser des tombes, par pitié.', fall: 'Morne pose sa pelle. Au-dessus des Landes, un chemin pâle s’éclaire dans le ciel.' },
};

// Sceaux de Brume : les terres lointaines restent fermées tant que l'histoire n'y mène pas.
// quest : quête principale qui ouvre la région (dès qu'elle est proposée).
export const SEALS = [
  { id: 'ambre', name: 'les Terres d’Ambre', x: 1080, z: 40, r: 360, quest: 'm9', need: 'l’Éclat de Souveraineté du Roi Sans Lumière' },
  { id: 'givre', name: 'les Cimes de Givre', x: -60, z: -1080, r: 380, quest: 'm12', need: 'l’Éclat d’Endurance du Colosse d’Ambre' },
  { id: 'sylve', name: 'la Canopée d’Émeraude', x: 180, z: 1080, r: 370, quest: 'm16', need: 'l’Éclat de Mémoire de la Reine de Givre' },
  { id: 'hantee', name: 'les Landes Spectrales', x: -1060, z: 260, r: 370, quest: 'm21', need: 'l’Éclat de Vie du Gardien Sylvestre' },
];

// Arènes : le sceau du seigneur ne s'ouvre que lorsque l'histoire vous y envoie
export const ARENA_QUEST = { roi: 'm8', colosse: 'm11', reine: 'm14', gardien: 'm20', fossoyeur: 'm25' };
export const ARENA_NEED = {
  roi: 'Maëlis doit d’abord vous juger prêt (Acte II)',
  colosse: 'Tarek, au Comptoir d’Ambre, connaît le chemin du Cirque',
  reine: 'Sœur Neige doit d’abord vous confier la montée du Givrecroc',
  gardien: 'Liora doit d’abord vous ouvrir la voie du Mont Feuillu',
  fossoyeur: 'Morwen doit d’abord vous mener jusqu’à la Crypte',
};

// Textes des quêtes principales, réécrits pour l'histoire (les objectifs ne changent pas)
export const MAIN_TEXT = {
  m1: { title: 'Le Réveil', desc: 'Vous ouvrez les yeux au pied du Cœur de Lumière, la dernière flamme de l’Aube. Il vous a rappelé de la Brume. Maëlis, la dernière prêtresse, vous attend près de la chapelle.' },
  m2: { title: 'Les os qui marchent', desc: 'Sans Lueur pour rentrer à l’Aube, les morts se relèvent dans la Brume. Ils rôdent autour du Phare de l’Aube, à l’est du village. Montrez-leur que les vivants ne reculent plus.' },
  m3: { title: 'La première flamme', desc: 'Les Phares portaient jadis la lumière de la Couronne. Celui de l’Aube vacille. Tracez une rune, puis offrez-lui de la lumière : vaincre des morts près de lui, tracer Lux (un trait vertical) ou le canaliser avec E.' },
  m4: { title: 'Les ailes du vent', desc: 'Sir Aldric veut savoir si un Porte-Aube peut voler. Sautez, puis appuyez à nouveau sur Espace pour ouvrir la paravoile. Rejoignez ensuite la Butte aux Vents, au nord-ouest du village.' },
  m5: { title: 'Murmures dans le bois', desc: 'Le Bois-Murmure chantait le nom de Sylvaën, l’Arbre-qui-marche. Il s’est tu. Purgez la forêt et rallumez le Phare des Murmures : la Brume doit reculer avant que vous n’alliez plus loin.' },
  m6: { title: 'La cité des cendres', desc: 'Au sud gisent les Cendres, ruines de Solaria, la cité du Roi. C’est là que tout a commencé. Chassez ses gardiens morts, rallumez son Phare… et lisez ce que disent ses stèles.' },
  m7: { title: 'Le phare des falaises', desc: 'Du Belvédère du Couchant, dit-on, on vit la Couronne se briser. Grimpez-y, rallumez le Phare du Couchant, et regardez vers le Pic : c’est là que vous irez ensuite.' },
  m8: { title: 'Le Roi Sans Lumière', desc: 'Maëlis vous juge prête, ou prêt. La route en lacets du Pic du Silence mène au Trône où Solenn, le premier Roi, garde l’Éclat de Souveraineté. Son sceau s’est ouvert pour vous. Allez-y à plusieurs si vous le pouvez.' },
  m9: { title: 'Vers les Terres d’Ambre', desc: 'L’Éclat de Souveraineté a fait reculer la Brume à l’est : la route des Terres d’Ambre est ouverte. Suivez-la jusqu’au Comptoir et présentez-vous à Kessa.' },
  m10: { title: 'Le Comptoir assiégé', desc: 'Les pillards d’ambre ont perdu la raison avec leur gardien. Chassez-les et rendez sa lumière au Phare d’Ambre, au milieu des mesas.' },
  m11: { title: 'Le cœur du Colosse', desc: 'Oramund, le Colosse d’Ambre, garde le Cirque contre tous depuis la Nuit du Bris, l’Éclat d’Endurance battant à la place de son cœur. Libérez-le. N’y allez pas seuls si vous le pouvez.' },
  m12: { title: 'Vers les Cimes', desc: 'Avec l’Éclat d’Endurance, la Brume du nord se déchire au Col des Lanternes. Rejoignez la Halte-du-Givre et parlez à Bjorn le trappeur.' },
  m13: { title: 'Le Sanctuaire Gelé', desc: 'Les gardes de givre servent encore Aëlys, la sœur du Roi. Repoussez-les du Sanctuaire, puis rallumez le Phare du Givre près du camp.' },
  m14: { title: 'La Reine de Givre', desc: 'Au sommet du Givrecroc, Aëlys chante pour ne pas oublier le visage de son frère, l’Éclat de Mémoire gelé dans le cœur. Montez, et apaisez-la.' },
  m16: { title: 'Les terres du sud', desc: 'L’Éclat de Mémoire vous a montré la Canopée telle qu’elle était. La Brume du sud s’ouvre enfin. Passez la Lisière des Fougères et rejoignez Liora au Refuge des Lianes.' },
  m17: { title: 'La sève corrompue', desc: 'La sève noire de la Brume monte par les racines de la Canopée. Abattez les morts moussus de la lisière et cueillez des orchidées célestes pour les remèdes de Liora.' },
  m18: { title: 'Le Phare d’Émeraude', desc: 'Le Phare d’Émeraude s’est éteint sous les lianes. Rallumez sa flamme verte : Sylvaën doit la voir de son mont.' },
  m19: { title: 'Le Temple Englouti', desc: 'Les druides qui servaient Sylvaën invoquent désormais les morts dans le Temple Englouti. Faites-les taire et ouvrez le coffre du temple.' },
  m20: { title: 'Le Gardien Sylvestre', desc: 'Sur le Mont Feuillu, Sylvaën l’Arbre-qui-marche pourrit autour de l’Éclat de Vie. Montez et libérez-le. Ses spores tombent du ciel : ne restez pas immobiles.' },
  m21: { title: 'Les Landes Spectrales', desc: 'L’Éclat de Vie a percé la Brume de l’ouest. Au-delà du Marais des Saules s’étendent les Landes, où les morts ne trouvent plus le chemin. Rejoignez la Veille-des-Morts et parlez à Morwen.' },
  m22: { title: 'Fleurs d’âme', desc: 'Les fleurs d’âme poussent là où une Lueur a trouvé la paix. Cueillez-en, et repoussez les goules qui rôdent dans la lande.' },
  m23: { title: 'Le Phare des Âmes', desc: 'Le Phare des Âmes montrait aux morts le chemin pâle de l’Aube. Rendez-lui sa lumière.' },
  m24: { title: 'Le Grand Cimetière', desc: 'Des revenants et des banshies tiennent le Grand Cimetière, que Morne remplit chaque nuit. Brisez leurs rangs, puis ouvrez le coffre des gardiens.' },
  m25: { title: 'Le Fossoyeur', desc: 'Dans la crypte, Morne le Passeur creuse des tombes pour les vivants, l’Éclat de Passage éteint au cœur. Entrez dans son arène et mettez fin à son œuvre. N’y allez pas seuls si vous le pouvez.' },
  m15: { title: 'L’Aube Éternelle', desc: 'Les cinq Éclats brillent dans vos mains et la Couronne Brisée se ressoude dans le ciel. Il reste le cœur de la Nuit : la Citadelle des Ombres, au-dessus du Puits d’Ombre. Réunissez vos compagnons au Portail des Expéditions et terrassez l’Avatar de la Brume.' },
};

// Ce que Maëlis dit selon l'acte (salutations)
export const ELDER_LINES = [
  ['Vous voilà debout, Porte-Aube. Le Cœur ne rappelle pas n’importe qui.'],
  ['Chaque Phare rallumé est une braise volée à la Nuit. Continuez.', 'Les Cendres gardent la mémoire de Solaria. Lisez les stèles, vous comprendrez.'],
  ['Le Pic vous attend. Solenn était un bon roi, autrefois. Souvenez-vous-en quand vous lèverez l’épée.'],
  ['Regardez le ciel : un rayon de la Couronne brille de nouveau. Vous l’avez rallumé.', 'L’Ambre et le Givre… Oramund et Aëlys. Je les ai connus, vous savez.'],
  ['La sève et les tombes. Les deux derniers sont les plus tristes, Porte-Aube.'],
  ['Cinq rayons. La Couronne se souvient d’être entière. Il ne reste que la Nuit elle-même.'],
];

// Stèles de mémoire : fragments du passé, à lire (E) et à retrouver dans les Chroniques
export const STELES = [
  { id: 'coeur', x: 14, z: 6, title: 'Le Cœur de Lumière', text: 'Quand la Couronne se brisa, une seule braise tomba loin des seigneurs : elle roula jusqu’au village des bergers et s’y planta comme une graine. On l’appela le Cœur. Il ne réchauffe pas grand-chose. Mais il se souvient de l’Aube, et parfois, il rappelle quelqu’un.' },
  { id: 'phares', x: 166, z: -108, title: 'Les Phares', text: 'Les prêtres de l’Aube élevèrent un Phare sur chaque colline, pour que la lumière de la Couronne aille jusqu’aux bergers les plus lointains. Un Phare ne brûle pas d’huile : il brûle de ce qu’on lui donne. Courage, prières, et parfois, la mort de ce qui ne devrait plus marcher.' },
  { id: 'murmures', x: 430, z: 22, title: 'Le chant des arbres', text: 'Les anciens du Bois-Murmure disent que les arbres chantaient le nom de Sylvaën quand il passait. Il marchait lentement, et la pluie le suivait. Les arbres se sont tus le jour où la sève est devenue noire. Écoutez bien : certains essaient encore.' },
  { id: 'solaria', x: 104, z: 462, title: 'Solaria', text: 'Ici se dressait Solaria, la cité du Roi, dont les toits d’or renvoyaient la lumière du Pic. La Nuit du Bris, le feu de la Couronne tomba sur elle comme une pluie. Il ne reste que les Cendres, et les gardes qui montent encore la relève, sans savoir pour qui.' },
  { id: 'solenn', x: 68, z: 505, title: 'Le serment de Solenn', text: '« Je garderai la lumière, et la lumière me gardera. » Ainsi jura Solenn le jour de son sacre. Les scribes notèrent que sa voix tremblait sur le dernier mot. Personne n’y prit garde. Personne ne pensait qu’un roi pût avoir peur de mourir.' },
  { id: 'miroir', x: -232, z: 32, title: 'Le Lac Miroir', text: 'Aëlys venait ici enfant, avec son frère. Ils jetaient des cailloux dans l’eau pour briser le reflet du Pic, et riaient de le voir se recoller. On dit qu’à l’aube, si l’on regarde assez longtemps, on voit encore deux enfants sur la rive.' },
  { id: 'sansflamme', x: -262, z: 288, title: 'Les Sans-Lueur', text: 'Depuis le Bris, les enfants naissent sans Lueur. Ils vivent, ils aiment, ils rient comme les autres. Mais quand ils meurent, il n’y a rien pour rentrer à l’Aube, et la Brume les garde. Sauf, très rarement, quand le Cœur décide autrement.' },
  { id: 'pic', x: -96, z: -226, title: 'Le Pic de l’Aube', text: 'Avant d’être le Pic du Silence, on l’appelait le Pic de l’Aube. La Couronne y reposait, si haut que son ombre ne touchait jamais le sol. Le chemin qui y monte était réservé aux rois. Il est ouvert à tous, désormais. Il n’y a plus personne pour l’interdire, sauf celui qui attend en haut.' },
  { id: 'bris', x: -548, z: -548, title: 'La Nuit du Bris', text: 'Du Belvédère, les veilleurs virent la Couronne s’allumer sur le Pic comme un second soleil, puis se fendre en cinq. Les éclats filèrent vers les cinq horizons. L’un d’eux s’éteignit au-dessus du Givre, et la neige ne fondit plus jamais.' },
  { id: 'couronne', x: 712, z: -742, title: 'La Couronne Brisée', text: 'Levez les yeux. Le cercle fendu qui flotte au-dessus du monde, c’est ce qui reste de la Couronne : sa forme, sans sa lumière. Chaque Éclat repris rallume un de ses rayons. Les anciens disent que le jour où elle sera entière, la Nuit retournera sous la mer.' },
  { id: 'oramund', x: 790, z: 92, title: 'Oramund', text: 'Les mineurs mirent cent ans à tailler le Colosse dans un bloc d’ambre où dormaient des insectes plus vieux que l’Aube. Ils lui donnèrent l’Éclat d’Endurance pour cœur, et un seul ordre : « Garde le Cirque. » Ils oublièrent de lui dire contre qui.' },
  { id: 'cirque', x: 1252, z: 64, title: 'Le Cirque d’Ambre', text: 'On venait de tout le continent prier le soleil dans le Cirque, et Oramund saluait chaque pèlerin d’un hochement de tête si lent qu’il fallait l’attendre une heure. Les marches sont encore usées par les genoux des fidèles.' },
  { id: 'aelys', x: -54, z: -790, title: 'Aëlys des Neiges', text: 'La sœur du Roi préférait les cimes aux palais. Elle connaissait le nom de chaque étoile et de chaque col. La Nuit du Bris, elle sentit son frère se perdre et monta sur le Givrecroc pour être plus près de lui. Elle y est encore.' },
  { id: 'gel', x: 222, z: -952, title: 'Les souvenirs gelés', text: 'Les gardes du Sanctuaire jurèrent de protéger la mémoire de la Reine. Ils la protègent si bien qu’ils ont oublié tout le reste, même leur propre nom. Dans la glace des murs, on devine des visages : ce sont ses souvenirs, et ils fondent un peu quand on les regarde.' },
  { id: 'seve', x: 190, z: 792, title: 'La sève noire', text: 'La Brume ne vient pas seulement de l’air. Elle monte aussi par la terre, et les racines la boivent. Sylvaën la sentit le premier. Il but l’Éclat de Vie pour la combattre de l’intérieur, comme on avale un remède amer. Le remède a perdu.' },
  { id: 'druides', x: 336, z: 1018, title: 'Les druides du Temple', text: 'Ils servaient Sylvaën et lui chantaient la pluie. Quand il cessa de répondre, ils cherchèrent une autre voix à servir. La Brume répond toujours, elle. C’est même tout ce qu’elle sait faire.' },
  { id: 'passeur', x: -760, z: 262, title: 'Le Passeur', text: 'Morne guidait les Lueurs des morts sur le chemin pâle, une lanterne à la main. Quand le chemin s’effaça, il garda la lanterne allumée pendant dix ans, au cas où. Puis il la posa, et prit une pelle.' },
  { id: 'tombes', x: -1018, z: 160, title: 'Les tombes des vivants', text: 'Certaines tombes du Grand Cimetière sont vides. Morne les creuse d’avance, une par habitant des Landes, avec le nom gravé et la date laissée en blanc. Il dit que c’est par pitié. Les habitants, eux, ne dorment plus.' },
  { id: 'azur', x: 902, z: 640, title: 'La Mer d’Azur', text: 'Les pêcheurs de la Côte racontent que la Nuit n’est pas partie quand l’Aube est venue : elle s’est seulement cachée sous la mer. Les jours de tempête, l’eau devient violette au large. Ces jours-là, ils ne sortent pas.' },
  { id: 'puits', x: -10, z: 58, title: 'Le Puits d’Ombre', text: 'Sous la Citadelle des Ombres s’ouvre le Puits d’où monte la Brume. La Citadelle n’a pas été bâtie pour le garder fermé, mais pour qu’on puisse y descendre. Quelqu’un, un jour, devait y descendre. Le Portail des Expéditions y mène, à qui porte les cinq Éclats.' },
];
