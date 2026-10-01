// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Built-in paint catalogue. Hex values are approximations of each paint's
// dried colour on a white basecoat (shades and contrasts show a mid-strength
// application). Format per line: "Name|hex" plus "|m" for metallics,
// optionally prefixed by a product code as "code:Name|hex".
// To add a collection permanently, append an entry to PAINT_COLLECTIONS.
//
// Hex values for Vallejo Game Color Wash, Army Painter and AK collections come
// from github.com/Arcturus5404/miniature-paints, MIT License,
// Copyright (c) 2022 Rick Fleuren. Vallejo 73.208 and 73.209 are estimated.
// Updated by Claude (claude-opus-5-5) on 2026-10-01: added those collections.
//
// PAINT_BRANDS sets the badge shown on paint tags. "short" is the badge text
// and "color" its background. "logo" is optional: a path to an image in the
// logos folder (published with the page) that replaces the text badge. A logo
// that fails to load falls back to the text badge. Brands without an entry get
// initials and a generated colour.
window.PAINT_BRANDS = {
  Citadel: { short: "CIT", color: "#1F3A6B", logo: "logos/citadel.png" },
  Vallejo: { short: "VAL", color: "#9E1B1F", logo: "logos/vallejo.png" },
  "Army Painter": { short: "AP", color: "#B5121B" },
  AK: { short: "AK", color: "#2B2B2B" }
};

window.PAINT_COLLECTIONS = [
  {
    brand: "Citadel",
    range: "Base",
    paints: `
Abaddon Black|231F20
Averland Sunset|FDB825
Balthasar Gold|A47552|m
Barak-Nar Burgundy|3F1E28
Bugman's Glow|834F44
Caledor Sky|366699
Caliban Green|00401F
Castellan Green|314821
Catachan Flesh|442B25
Celestra Grey|90A8A8
Ceramite White|FFFFFF
Corax White|F2F2F2
Corvus Black|171314
Daemonette Hide|696684
Death Guard Green|848A66
Deathworld Forest|5C6730
Dryad Bark|33312D
Gal Vorbak Red|4B213C
Grey Seer|A2A5A7
Incubi Darkness|0B474A
Ionrach Skin|D5CDB0
Iron Warriors|5A5F63|m
Jokaero Orange|EE3823
Kantor Blue|02134E
Khorne Red|6A0001
Leadbelcher|888D8F|m
Lupercal Green|002C2B
Macragge Blue|0D407F
Mechanicus Standard Grey|3D4B4D
Mephiston Red|9A1115
Morghast Bone|CDB88C
Mournfang Brown|5E2D18
Naggaroth Night|3D3354
Night Lords Blue|002B5C
Phoenician Purple|440052
Rakarth Flesh|A29E91
Retributor Armour|B98B40|m
Rhinox Hide|462F30
Runelord Brass|8E7646|m
Screamer Pink|7C1645
Screaming Bell|7E4A2C|m
Skavenblight Dinge|47413B
Steel Legion Drab|5E5134
Stegadon Scale Green|074863
Thondia Brown|5F3B26
Thousand Sons Blue|177E8E
Waaagh! Flesh|1F5429
Warplock Bronze|5C4033|m
Wraithbone|DBD1B2
Zandri Dust|9E915C
`
  },
  {
    brand: "Citadel",
    range: "Layer",
    paints: `
Administratum Grey|949B95
Ahriman Blue|1F8C9C
Alaitoc Blue|295788
Altdorf Guard Blue|2D4696
Auric Armour Gold|D4A53A|m
Baharroth Blue|58C1CD
Balor Brown|8B5910
Baneblade Brown|937F6D
Bestigor Flesh|D38A57
Blue Horror|A2BAD2
Brass Scorpion|B7885F|m
Cadian Fleshtone|C47652
Calgar Blue|4272B8
Canoptek Alloy|AC8A55|m
Changeling Pink|F4AFCD
Dark Reaper|354D4C
Dawnstone|70756E
Deathclaw Brown|AF634F
Dechala Lilac|9F8AB5
Doombull Brown|5D0009
Dorn Yellow|FFF55A
Elysian Green|6B8C37
Emperor's Children|B74073
Eshin Grey|484B4E
Evil Sunz Scarlet|C01411
Fenrisian Grey|6D94B3
Fire Dragon Bright|F4874E
Flash Gitz Yellow|FFF300
Flayed One Flesh|EEC483
Fulgrim Pink|F3ABCA
Fulgurite Copper|C77958|m
Gauss Blaster Green|84C3AA
Gehenna's Gold|DBA674|m
Genestealer Purple|7658A5
Gorthor Brown|5F463F
Hashut Copper|B7794B|m
Hexos Palesun|FFF7A0
Hoeth Blue|4C78AF
Iron Hands Steel|A5A6A8|m
Ironbreaker|A1A6A9|m
Kabalite Green|038C67
Kakophoni Purple|8866A9
Karak Stone|BB9662
Kislev Flesh|D1A570
Knight-Questor Flesh|9E5B55
Krieg Khaki|C0BD81
Liberator Gold|D3B587|m
Loren Forest|486C25
Lothern Blue|34A2CF
Lugganath Orange|F69B82
Moot Green|3DAF44
Nurgling Green|B8CC82
Ogryn Camo|9DA94B
Pallid Wych Flesh|CDCEBE
Pink Horror|8E2757
Runefang Steel|C3CACE|m
Russ Grey|547588
Screaming Skull|C8CAA0
Skarsnik Green|5F9370
Skrag Brown|8B4806
Slaanesh Grey|8B8893
Sons of Horus Green|00545E
Sotek Green|0B6371
Squig Orange|AA4F44
Stormhost Silver|BBC6C9|m
Stormvermin Fur|736B65
Straken Green|628126
Sybarite Green|17A166
Sycorax Bronze|CBB394|m
Tallarn Sand|A07409
Tau Light Ochre|BC6B10
Teclis Blue|317EC1
Temple Guard Blue|339A8D
Thunderhawk Blue|417074
Troll Slayer Orange|F36D14
Tuskgor Fur|883636
Ulthuan Grey|C7E0D9
Ungor Flesh|D6A766
Ushabti Bone|BBBB7F
Warboss Green|317E57
Warpfiend Grey|6B6A74
Warpstone Glow|1E7331
Wazdakka Red|880804
White Scar|FFFFFF
Wild Rider Red|EA2F28
Word Bearers Red|6B1A10
Xereus Purple|471F5F
Yriel Yellow|FFD900
Zamesi Desert|D7A646
`
  },
  {
    brand: "Citadel",
    range: "Shade",
    paints: `
Aethermatic Blue|5C9BA8
Agrax Earthshade|5A442A
Agrax Earthshade Gloss|5A442A
Athonian Camoshade|6D6C2D
Berserker Bloodshade|5C0F1C
Biel-Tan Green|1E4D2B
Carroburg Crimson|7A1830
Casandora Yellow|E09A20
Coelia Greenshade|0E4A4C
Drakenhof Nightshade|0E2E5A
Druchii Violet|5A2F57
Fuegan Orange|B04A1C
Kroak Green|3E6B3A
Mortarion Grime|6A6334
Nuln Oil|14100E
Nuln Oil Gloss|14100E
Poxwalker|8E9173
Reikland Fleshshade|9F5A36
Reikland Fleshshade Gloss|9F5A36
Seraphim Sepia|7F5324
Targor Rageshade|55233C
Tyran Blue|245C8C
`
  },
  {
    brand: "Citadel",
    range: "Contrast",
    paints: `
Aeldari Emerald|0F6B4E
Aggaros Dunes|BB8A3B
Akhelian Green|1A7F7A
Apothecary White|C6D2D6
Asurmen Blue|1D4E8F
Baal Red|9E1A1E
Bad Moon Yellow|F2C318
Basilicanum Grey|4E4F51
Black Legion|1E1E20
Black Templar|25292E
Blood Angels Red|B51520
Briar Queen Chill|7BA3B8
Celestium Blue|5E88B5
Creed Camo|65703B
Cygor Brown|5A3A26
Dark Angels Green|1B4B2B
Darkoath Flesh|8F5234
Doomfire Magenta|A71D6A
Flesh Tearers Red|77101A
Fyreslayer Flesh|A8633E
Garaghak's Sewer|7E6844
Gore-Grunta Fur|8A3F1C
Gryph-Charger Grey|5C7E90
Gryph-Hound Orange|D8641C
Guilliman Flesh|BF8061
Imperial Fist|E8B81A
Iyanden Yellow|E6A822
Karandras Green|2C6843
Kroxigor Scales|3F7D6E
Leviadon Blue|1F3B67
Luxion Purple|6C3D8E
Magos Purple|7A4A8F
Mantis Warriors Green|4B8A2E
Militarum Green|6A7A38
Nazdreg Yellow|D9A23A
Nighthaunt Gloom|5AA3A0
Ork Flesh|4F7A2A
Plaguebearer Flesh|B5B37A
Ratling Grime|3E3A33
Shyish Purple|4B2A5E
Skeleton Horde|B99A63
Snakebite Leather|9A5F2A
Space Wolves Grey|8FA6B8
Striking Scorpion Green|3F8A3A
Talassar Blue|1E6FB3
Terradon Turquoise|1C6E78
Ultramarines Blue|1E3F89
Volupus Pink|8C2A55
Warp Lightning|4E9C2E
Wyldwood|4A2D22
`
  },
  {
    brand: "Citadel",
    range: "Dry",
    paints: `
Astorath Red|A83426
Changeling Pink (Dry)|F3B5CC
Eldar Flesh|E7C290
Etherium Blue|A8BDD0
Golgfag Brown|8C5129
Hellion Green|8DC0A5
Hexos Palesun (Dry)|FFF6A6
Imrik Blue|8CBCD6
Kindleflame|F4A487
Longbeard Grey|C8CBBB
Lucius Lilac|BDB2CE
Necron Compound|9A9EA2|m
Niblet Green|7FB06A
Praxeti White|F5F5EC
Ryza Rust|C8531F
Sigmarite|D4B478|m
Skink Blue|6EB3C2
Stormfang|8DA9C3
Sylvaneth Bark|544A3A
Terminatus Stone|BEB09B
Tyrant Skull|C7BE89
Underhive Ash|B8B18C
Verminlord Hide|9E8378
`
  },
  {
    brand: "Citadel",
    range: "Technical",
    paints: `
Agrellan Earth|9E7D55
Armageddon Dust|C29B5A
Astrogranite|6E6E6C
Blood for the Blood God|6A0A0A
Hexwraith Flame|38D3B0
Martian Ironearth|A3543B
Mordant Earth|332B25
Nihilakh Oxide|7BC1AE
Nurgle's Rot|8A8A1E
Soulstone Blue|1A5A9E
Spiritstone Red|B0142A
Stirland Battlemire|5A4632
Stirland Mud|4B3522
Tesseract Glow|6CDB2E
Typhus Corrosion|3D3528
Valhallan Blizzard|E9EEF0
Waystone Green|1E8A3E
`
  },
  {
    brand: "Vallejo",
    range: "Game Color",
    paints: `
72.001:Dead White|FFFFFF
72.003:Pale Flesh|F2D3B7
72.004:Elfic Flesh|E8B795
72.005:Moon Yellow|F8D823
72.006:Sun Yellow|F9BF10
72.007:Gold Yellow|F7A21C
72.008:Orange Fire|EB6122
72.009:Hot Orange|E6421F
72.010:Bloody Red|B8141B
72.011:Gory Red|8E1A1E
72.012:Scarlet Red|9B1D22
72.013:Squid Pink|D4808D
72.014:Warlord Purple|8E1E4F
72.015:Hexed Lichen|5B2B6E
72.016:Royal Purple|49275E
72.017:Sick Blue|2A5596
72.019:Night Blue|1E2A4A
72.020:Imperial Blue|1C3A74
72.021:Magic Blue|1F5EA8
72.022:Ultramarine Blue|22448F
72.023:Electric Blue|5C9ED3
72.024:Turquoise|0A8C94
72.025:Foul Green|3AA59A
72.026:Jade Green|1A7C58
72.027:Scurvy Green|1E5646
72.028:Dark Green|25432D
72.029:Sick Green|3F8A33
72.030:Goblin Green|4C8A2C
72.031:Livery Green|7FB02C
72.032:Scorpy Green|60A83A
72.033:Yellow Olive|5B5A26
72.034:Bone White|D8CCA3
72.035:Dead Flesh|A9B57A
72.036:Bronze Fleshtone|C57A45
72.037:Filthy Brown|C4822C
72.038:Scrofulous Brown|C28D2E
72.039:Plague Brown|A6792F
72.040:Leather Brown|7A4A2A
72.041:Dwarf Skin|C68A68
72.042:Parasite Brown|8C4A28
72.043:Beasty Brown|5C3D2A
72.044:Dark Fleshtone|5A2E22
72.045:Charred Brown|3B2A24
72.046:Ghost Grey|C7CFD6
72.047:Wolf Grey|7F8E9E
72.048:Sombre Grey|3F4652
72.049:Stonewall Grey|A5A49D
72.050:Cold Grey|5E6468
72.051:Black|1B1B1B
72.052:Silver|C0C4C6|m
72.053:Chainmail Silver|A4A7A9|m
72.054:Gunmetal Metal|5F6264|m
72.055:Polished Gold|C9A24A|m
72.056:Glorious Gold|B8862F|m
72.057:Bright Bronze|A06D3B|m
72.058:Brassy Brass|B09A57|m
72.059:Hammered Copper|A45A36|m
72.060:Tinny Tin|7A5A3E|m
72.061:Khaki|A69B72
72.062:Earth|6E5237
Cayman Green|3C6B42
Heavy Charcoal|2F3133
Heavy Warm Grey|8C857A
Heavy Bluegrey|4F6275
Heavy Skintone|D19A76
Heavy Goldbrown|B77A2D
Heavy Red|8E1A1A
Heavy Violet|4E2A55
Heavy Khaki|8C7F4E
Heavy Sienna|7A3E22
Heavy Green|2F5A34
`
  },
  {
    brand: "Vallejo",
    range: "Model Color",
    paints: `
70.950:Black|1C1C1C
70.862:Black Grey|2E2F30
70.995:German Grey|3C4043
70.994:Dark Grey|55585A
70.992:Neutral Grey|6E7072
70.836:London Grey|7C7F7D
70.991:Dark Sea Grey|5E6A70
70.870:Medium Sea Grey|8A9092
70.989:Sky Grey|B6BCB5
70.990:Light Grey|A9ACA6
70.907:Pale Grey Blue|A8B9C2
70.943:Grey Blue|5D7382
70.904:Dark Blue Grey|3E4A57
70.951:White|FFFFFF
70.820:Off-White|EFEBDC
70.918:Ivory|EEE3C2
70.949:Light Yellow|F6E27A
70.952:Lemon Yellow|F5E21A
70.953:Flat Yellow|F6C81A
70.948:Golden Yellow|F2B21E
70.806:German Yellow|D7A042
70.913:Yellow Ochre|C88A2E
70.912:Tan Yellow|D1A864
70.956:Clear Orange|F07A1E
70.851:Bright Orange|F05A1E
70.910:Orange Red|DC3D22
70.957:Flat Red|C0181E
70.926:Red|B41A20
70.817:Scarlet|C82A1E
70.909:Vermillion|D2361E
70.908:Carmine Red|A0141E
70.902:Burnt Cad. Red|7E1A1C
70.814:Burnt Red|6E2A1E
70.859:Black Red|3E1A1A
70.945:Magenta|A0265E
70.944:Old Rose|C8828A
70.804:Beige Red|D19A86
70.959:Purple|5E2A6A
70.960:Violet|4A2E6E
70.810:Royal Purple|56306A
70.811:Blue Violet|4B4A8A
70.962:Flat Blue|1E4A9A
70.925:Blue|22407A
70.963:Medium Blue|2E5AA0
70.839:Ultramarine|1E3C8E
70.930:Dark Blue|1C2A4E
70.807:Oxford Blue|1E2A44
70.899:Dark Prussian Blue|1A3350
70.965:Prussian Blue|1E4468
70.964:Field Blue|4A6A8A
70.841:Andrea Blue|3C7AB8
70.961:Sky Blue|6BA3CE
70.906:Pale Blue|A9C8DD
70.966:Turquoise|1E8C8C
70.838:Emerald|1E8A5A
70.968:Flat Green|2E7A3A
70.969:Park Green Flat|3E8A34
70.891:Intermediate Green|2F6A3A
70.970:Deep Green|1E4A2E
70.893:US Dark Green|3A4A2E
70.890:Reflective Green|2E5A48
70.881:Yellow Green|8AAE3A
70.967:Olive Green|4E5230
70.894:Russian Green|4A5A38
70.823:Luftwaffe Camo Green|3E4E3A
70.979:German Camo Dark Green|3A4430
70.886:Green Grey|7F8A6A
70.914:Green Ochre|9A8A4A
70.988:Khaki|8A7E58
70.921:English Uniform|6A5A3A
70.920:German Uniform|4E5244
70.873:US Field Drab|6A5638
70.887:Brown Violet|4E4830
70.819:Iraqi Sand|C8B48A
70.977:Desert Yellow|C29E62
70.847:Dark Sand|B09A72
70.976:Buff|D2B48A
70.837:Pale Sand|E2D2AE
70.844:Deck Tan|C8C0A8
70.884:Stone Grey|B0A68C
70.983:Flat Earth|7E5A3A
70.984:Flat Brown|6E3A1E
70.846:Mahogany Brown|6A3422
70.985:Hull Red|5A2A22
70.872:Chocolate Brown|4E3222
70.875:Beige Brown|6E4E36
70.871:Leather Brown|8A5A36
70.940:Saddle Brown|7A4428
70.941:Burnt Umber|4A3226
70.818:Red Leather|9A4A2E
70.843:Cork Brown|A57A52
70.876:Brown Sand|B08A5E
70.815:Basic Skin Tone|E2B08E
70.860:Medium Fleshtone|D2946E
70.845:Sunny Skin Tone|E8BE9A
70.928:Light Flesh|F0CEB0
70.955:Flat Flesh|E4A882
70.997:Silver|B8BCBE|m
70.996:Gold|C49A3E|m
70.801:Brass|A88E4E|m
70.863:Gunmetal Grey|5A5E60|m
`
  },
  {
    brand: "Vallejo",
    range: "Game Color Wash",
    paints: `
73.201:Black Wash|343235
73.207:Blue Wash|1A5B9B
73.204:Flesh Wash|B67C78
73.205:Green Wash|72B25B
73.202:Pale Grey Wash|CACAD2
73.206:Red Wash|D55E86
73.200:Sepia Wash|8B622C
73.203:Umber Wash|766053
73.209:Violet Wash|5A2A6E
73.208:Yellow Wash|D9A21E
`
  },
  {
    brand: "Army Painter",
    range: "Warpaints Fanatic",
    paints: `
Abyssal Blue|00506C
Aegis Aqua|32B3D5
Afterglow|E4EA8D
Agate Skin|D7877B
Alien Purple|6154A3
Alpha Blue|667DC0
Amber Skin|C4A083
Amulet Aqua|68C5B6
Ancient Stone|D0C3A3
Angel Green|173E31
Angelic Red|D42C39
Aqua Alchemy|24BBA6
Aquamarine|56C4CD
Arctic Gem|1995D4
Army Green|5D7554
Ash Grey|84878F
Augur Blue|ACBCE2
Autumn Sage|75AD98
Barbarian Flesh|F69B7F
Baron Blue|7C95CC
Barren Dune|DEBB72
Basilisk Red|6C2539
Blood Chalice|DB4B50
Boney Spikes|E6D4C1
Bootstrap Brown|5D4D4D
Brainmatter Beige|DEDBD3
Brigade Grey|D0D0D2
Brigadine Brown|443A40
Bright Gold|987B1A|m
Bright Sapphire|84CEF0
Buffed Hide|B3756A
Burning Ore|F2653E
Burnt Turf|BE9859
Camouflage Green|6E8358
Carnelian Skin|5D3E46
Cobalt Metal|2E4249|m
Command Khaki|B49488
Company Grey|BCBEC2
Crystal Blue|0273BC
Cultist Purple|6962AB
Daemonic Yellow|FECE2A
Dark Emerald|3B4A25
Death Metal|2B2B2B|m
Deep Azure|006B79
Deep Grey|4B5164
Deep Ocean Blue|1B3044
Demigod Flames|D17B41
Desert Yellow|856D45
Diabolic Plum|562D74
Diviner Light|D59FC5
Doomfire Drab|F9D9E6
Dorado Skin|EEC79E
Dragon Red|BF283B
Dryad Brown|613630
Dusty Skull|8B7C68
Elder Flower|A8577B
Electric Lime|BDD532
Emerald Forest|5BBB4D
Enchanted Pink|B66CAE
Eternal Hunt|279A4C
Evergreen Fog|396360
Evil Chrome|5B3B2F|m
Ferocious Green|75C377
Fiendish Yellow|EC9A44
Figgy Pink|E3AFC9
Flickering Flame|F58B3D
Forbidden Fruit|CD88A9
Forest Faun|A1C7AF
Frost Blue|9ABEDE
Fur Brown|774544
Gargoyle Grey|A8A292
Gemstone Red|821D23
Glittering Green|2E794A
Glowing Inferno|F79D42
Gothic Blue|2E3E79
Great Hall Grey|BBB4A6
Greedy Gold|745218|m
Greenskin|1F7843
Grey Castle|929286
Grotesque Green|B3C29D
Guardian Green|226248
Gun Metal|4F5053|m
Hexed Violet|8D81BE
Hydra Turquoise|149398
Ice Yellow|FFEDAD
Imperial Navy|063565
Impish Rouge|D957A0
Inner Light|FDCB5F
Jasper Skin|BA7372
Kraken Lavender|D5CAE5
Lava Orange|F5792C
Leafy Green|76C045
Leather Brown|7C5B54
Legendary Red|EF4B3E
Leopard Stone Skin|E7B4B1
Magecast Magenta|704099
Marine Mist|94D6D7
Matt Black|000000
Matt White|FFFFFF
Medieval Forest|437C6D
Mithril|9E9FA3
Mocca Skin|81655A
Moldy Wine|7D3451
Molten Lava|F05A3E
Moonstone Skin|C57B74
Mossy Green|B1DCC0
Mulled Berry|623348
Necrotic Flesh|9AA984
Neptune Glow|75CED4
Night Sky|304358
Oak Brown|39262A
Obsidian Skin|4A4046
Olive Drab|7A905F
Onyx Skin|664A4D
Opal Skin|FFD2C8
Pale Sand|EFEAD3
Paratrooper Tan|9A776C
Patagon Pine|63917F
Pearl Skin|FFE3D8
Phalanx Blue|048BAE
Pharaoh Guard|0C7C61
Pink Potion|F4B9D4
Pixie Pink|D96FAE
Plate Mail Metal|686A6E|m
Prairie Ochre|696242
Pure Red|CD151C
Quartz Skin|F0D0B4
Raging Rose|E96663
Raging Rouge|F68F82
Rainforest|8BC63E
Red Copper|4D2C30|m
Regal Blue|004F88
Resplendent Red|96272F
Rough Iron|352D25|m
Royal Blue|0162AF
Ruby Skin|FBB99D
Ruddy Umber|985951
Runic Cobalt|7496B4
Sacred Scarlet|F1634C
Scarab Green|193C44
Shieldwall Blue|08A1CC
Shining Silver|86888C|m
Skeleton Bone|C2B293
Space Dust|FFE388
Spellbound Fuchsia|AD4DA0
Stratos Blue|33658F
Tainted Gold|575235|m
Talisman Teal|1FAE91
Temple Gate Teal|046154
Terrestial Titan|303149
Thunderous Blue|34577B
Tidal Blue|026B93
Tiger’s Eye Skin|904D52
Tomb King Tan|A29278
Topaz Skin|B25A53
Tourmaline Skin|E3988B
Tree Ancient|513430
Triumphant Navy|1A2C53
True Brass|635D58|m
True Copper|6B4731|m
Tundra Taupe|4B4D3E
Turquoise Siren|29B3B9
Ultramarine Blue|284D8E
Uniform Grey|6B707C
Urban Buff|DBB9AB
Violent Vermillion|F37964
Violet Coven|A999C7
Vivid Volt|CFDC51
Warlock Magenta|834D9F
Warped Yellow|FED548
Wasteland Clay|A38755
Weapon Bronze|955610|m
Weird Elixir|E092BF
Wicked Pink|CE0886
Wild Green|46B758
Wilted Rose|ECC5D7
Wolf Grey|4F78A3
Woodland Camo|4B6149
Worn Stone|C4BFB1
Wyvern Fury|993243
`
  },
  {
    brand: "Army Painter",
    range: "Fanatic Wash",
    paints: `
Blue Tone|132B47
Brush-On Primer|727475
Dark Blue Tone|17202E
Dark Red Tone|2E131A
Dark Rust|290F12
Dark Skin Shade|443638
Dark Tone|1F1F1F
Data System Glow|87C866
Disgusting Slime|A5C345
Dry Blood|24000E
Fresh Rust|C25428
Green Tone|1F3625
Lens Flare Glow|FFF464
Light Tone|7F5216
Magenta Tone|590135
Military Shade|23270E
Oil Stains|1D252B
Oozing Vomit|7B5C1D
Orange Tone|64300F
Plasma Coil Glow|5ECDF4
Power Node Glow|F286B5
Purple Tone|241C31
Radiation Glow|FBB375
Red Tone|531F28
Rust Tone|452A11
Sepia Tone|734014
Soft Tone|563D2A
Strong Skin Shade|442824
Strong Tone|211913
True Blood|8D0422
Verdigris|61B89B
Wash Medium|B1B3B4
`
  },
  {
    brand: "Army Painter",
    range: "Speedpaint 2.0",
    paints: `
Absolution Green|214A28
Aged Hide|D56C4F
Algae Green|9CAA53
Ancient Honey|EBBD21
Ashen Stone|B3B9B9
Aztec Gold|62732F|m
Battleship Grey|B7C6C9
Beowulf Blue|0C3F80
Blinding Light|F5F4EF
Blood Red|DB3016
Bony Matter|B69471
Brazen Copper|6A3D37|m
Bright Red|E15A3D
Broadsword Silver|595854|m
Brownish Decay|7B6C33
Burnished Red|633B33
Burnt Moss|4D5A50
Camo Cloak|5A713B
Caribbean Ocean|09A6B5
Carmine Dragon|DC3058
Charming Chartreuse|C9CF47
Cloudburst Blue|3C4258
Crusader Skin|EB9A5B
Dark Wood|482D1A
Desolate Brown|7A703B
Dusk Red|603E3D
Enchanted Steel|4F595B|m
Familiar Pink|D62F7F
Fire Drake|D2916B
Fire Giant Orange|E77924
Forest Sprite|6FA045
Ghillie Dew|90AC23
Ghoul Green|44A963
Glittering Loot|836608
Goddess Glow|9A5751
Golden Armour|714808|m
Gravelord Grey|44474C
Grim Black|161511
Gunner Camo|325141
Hardened Leather|8C501E
Highlord Blue|1B5682
Hive Dweller Purple|57366B
Hoard Bronze|867240|m
Holy White|E2E1DC
Hoplite Gold|907317|m
Howling Sand|CECFB0
Lizardfolk Cyan|39989C
Maggot Skin|CBC861
Magic Blue|0B79AE
Maize Yellow|F6D31F
Malignant Green|BECB3D
Moody Mauve|A14F7D
Moonlake Coral|A5396D
Mummified Grime|666748
Murder Scene|6E2A39
Noble Skin|4F493D
Nuclear Sunrise|E56F25
Occultist Cloak|30323E
Ochre Clay|B8A936
Orc Skin|258335
Pallid Bone|E1CC95
Pastel Indigo|9FBCDA
Pastel Lavender|D5BFD4
Pastel Salmon|F3C498
Pastel Seafoam|B8D7C8
Pastel Yellow|F6E178
Peachy Flesh|EDA668
Periwinkle Purple|585396
Plasmatic Bolt|0A9B8C
Polished Silver|888782|m
Poppy Red|C8453B
Princess Pink|E29FB0
Purple Alchemy|AE3F6A
Purple Swarm|653483
Raging Sea|1B95A4
Rigor Mortis|ADAD6F
Royal Robes|5363A1
Ruddy Fur|9D4925
Runic Grey|557989
Sand Golem|CB9413
Satchel Brown|583D32
Shamrock Green|60AB2C
Slaughter Red|991926
Speedpaint Medium|F3F0EB
Talos Bronze|6B3B27|m
Thunderbird Blue|66B797
Tidal Wave|1278B6
Tyrian Navy|2A414F
Warrior Skin|A37051
Zealot Yellow|F4D008
`
  },
  {
    brand: "AK",
    range: "3rd Gen Standard",
    paints: `
AK11152:Alga Green|555E1B
AK11086:Amaranth Red|CF4E27
AK11183:Amethyst Blue|332A47
AK11167:Anthracite Grey|1C2A2B
AK11170:Aquatic Turquoise|006557
AK11172:Archaic Turquoise|003839
AK11024:Ash Grey|42423A
AK11021:Basalt Grey|5B605A
AK11052:Basic Skin Tone|F7B57B
AK11030:Beige|E2B848
AK11064:Beige Red|DE935A
AK11160:Black Green|131E0D
AK11098:Black Red|42271E
AK11089:Blood Red|C52219
AK11011:Blue Grey|C7D0CD
AK11070:Blue Violet|886DA4
AK11169:Blue-green|358578
AK11094:Bordeaux Red|A13B2F
AK11093:Brick Red|9E4429
AK11127:British Khaki|654D1F
AK11063:Brown Rose|D78464
AK11151:Brownish Green|57460E
AK11031:Buff|D1AC5C
AK11079:Burn Orange|DB5E30
AK11097:Burnt Red|533125
AK11111:Burnt Umber|2D1E01
AK11085:Cadmium Red|E9582C
AK11156:Camouflage Green|4F411C
AK11091:Carmine|B83E26
AK11113:Chocolate (chipping)|331E09
AK11214:Clear Blue|0D265C
AK11216:Clear Green|029837
AK11218:Clear Orange|EB5D0B
AK11213:Clear Red|C61215
AK11215:Clear Smoke|734C21
AK11217:Clear Yellow|F49401
AK11155:Command Green|312E0D
AK11181:Dark Blue|1E2D4C
AK11164:Dark Blue-grey|4A5E53
AK11109:Dark Brown|533914
AK11056:Dark Flesh|EBA43A
AK11146:Dark Green|224618
AK11133:Dark Green-grey|3B4D3D
AK11022:Dark Grey|494A45
AK11189:Dark Prussian Blue|0A0C1B
AK11107:Dark Rust|542303
AK11033:Dark Sand|E6BC56
AK11190:Dark Sea Blue|0D1814
AK11015:Dark Sea Grey|7B7873
AK11083:Dead Red|F54949
AK11114:Deck Tan|CCC4AF
AK11058:Decomposed Flesh|B7A261
AK11176:Deep Sky Blue|69B4C7
AK11095:Dirty Red|7F190D
AK11043:Dirty Yellow|ECA71C
AK11177:Ducat Blue|3A889F
AK11144:Emerald|036242
AK11020:English Grey|6D6D65
AK11153:Extra Dark Green|243128
AK11135:Faded Green|7C8872
AK11178:Fluorescent Blue|004064
AK11129:Fluorescent Green|98C31E
AK11068:Fluorescent Magenta|FF4C69
AK11081:Fluorescent Orange|FE5102
AK11049:Fluorescent Yellow|F6F101
AK11166:French Blue|545653
AK11136:Frog Green|97B821
AK11154:German Field Grey|423E23
AK11025:German Grey|383830
AK11117:Golden Brown|AB7602
AK11139:Golden Olive|737B26
AK11041:Golden Yellow|FEB449
AK11019:Graphite|6C6E60
AK11140:Grass Green|62832C
AK11122:Green Ochre|A68236
AK11134:Green Sky|8BB283
AK11126:Green-brown|705923
AK11132:Green-grey|DFE4BC
AK11005:Greenish White|E4EECC
AK11016:Grey Green|808064
AK11165:Grey-blue|5F6772
AK11125:Grey-brown|705B3C
AK11112:Grim Brown|211404
AK11008:Grimy Grey|DFC998
AK11150:Gunship Green|485335
AK11108:Hull Red|381A02
AK11036:Ice Yellow|FEEE8E
AK11180:Imperial Blue|192152
AK11138:Interior Yellow Green|ACA300
AK11163:Intermediate Blue|676966
AK11149:Intermediate Green|506E32
AK11004:Ivory|F3EEC8
AK11123:Japanese Brown|966D1B
AK11066:Laser Magenta|6B102F
AK11048:Laser Yellow|F5EF2B
AK11023:Lead Grey|464741
AK11110:Leather Brown|46311E
AK11047:Lemon Yellow|FFE121
AK11100:Light Brown|CF8139
AK11115:Light Earth|D0B580
AK11050:Light Flesh|FFDFB6
AK11141:Light Green|59922B
AK11077:Light Orange|F07A3C
AK11186:Light Prussian Blue|132A38
AK11105:Light Rust|DB5615
AK11071:Lilac|656074
AK11137:Lime Green|819F1D
AK11145:Lizard Green|175A31
AK11051:Luminous Flesh|EDC180
AK11128:Luminous Green|CDD742
AK11082:Luminous Orange|F18700
AK11067:Magenta|B1325F
AK11106:Mahogany Brown|622A05
AK11092:Matt Red|B5311C
AK11184:Medium Blue|163A48
AK11054:Medium Flesh Tone|C98230
AK11010:Medium Grey|B6B8A3
AK11148:Medium Olive Green|3E501C
AK11078:Medium Orange|FA682C
AK11103:Medium Rust|9C4B30
AK11034:Medium Sand|CC9B35
AK11014:Medium Sea Grey|A19B81
AK11124:Middle Stone|8B7029
AK11143:Mint Green|008C5F
AK11120:Mud Brown|705331
AK11018:Neutral Grey|696E68
AK11173:Ocean Blue|1E3636
AK11099:Ocher Orange|F5A75F
AK11118:Ochre|C7932D
AK11002:Offwhite|EBEBE1
AK11062:Old Rose|FE9679
AK11147:Olive Green|4B5F20
AK11101:Orange Brown|B1581E
AK11188:Oxford|353942
AK11161:Pale Blue|B4C4B7
AK11013:Pale Grey|AEAFB4
AK11032:Pale Sand|EFD581
AK11038:Pale Yellow|FEDD58
AK11130:Pistachio|DCD225
AK11039:Purulent Yellow|EBD03B
AK11053:Radiant Flesh|FEB254
AK11046:Radiant Yellow|FFD409
AK11017:Reddish Grey|7B6B52
AK11158:Reflective Green|352E11
AK11007:Rock Grey|C1B897
AK11027:Rubber Black|29251A
AK11084:Ruby|CF4747
AK11159:Russian Green|292907
AK11104:Saddle Brown|683A2B
AK11040:Sahara Yellow|B1930D
AK11061:Salmon|F5A175
AK11035:Sand Yellow|E9BD3A
AK11087:Scarlet Red|D03B27
AK11060:Sickly Pink|F6AF91
AK11006:Silver Grey|E2D7B7
AK11175:Sky Blue|88C2CD
AK11012:Sky Grey|BBBAB6
AK11028:Smoke Black|2B2B21
AK11174:Snow Blue|CAE4E1
AK11162:Spectrum Blue|B4BEBF
AK11185:Star Blue|014760
AK11187:Strong Dark Blue|04151F
AK11055:Sunny Skin Tone|FFA84F
AK11121:Tan Earth|7D5C33
AK11116:Tan Yellow|D19849
AK11026:Tenebrous Grey|302C21
AK11171:Turquoise|004A4D
AK11179:Ultramarine|1E357B
AK11157:Us Dark Green|423910
AK11057:Vampiric Flesh|CFBC81
AK11090:Vermillion|C44C33
AK11075:Violet Red|573536
AK11042:Volcanic Yellow|F09218
AK11009:Warm Grey|B6A88B
AK11003:White Grey|F5F5ED
AK11096:Wine Red|69140D
AK11044:Yellow|FAB711
`
  },
  {
    brand: "AK",
    range: "3rd Gen Intense",
    paints: `
AK11029:Black|101207
AK11182:Deep Blue|1A4067
AK11102:Deep Brown|854A2A
AK11142:Deep Green|1C6128
AK11080:Deep Orange|FE5E14
AK11074:Deep Purple|7A4967
AK11088:Deep Red|DC211A
AK11072:Deep Violet|74536E
AK11045:Deep Yellow|FDC500
AK11065:Intense Pink|E9748F
AK11001:White|FFFFFF
`
  },
  {
    brand: "AK",
    range: "3rd Gen Metallic",
    paints: `
AK11207:Aluminium|AFAFAF|m
AK11202:Anodized Violet|9D8696|m
AK11200:Astral Beryllium|799E8D|m
AK11194:Brass|A55D09|m
AK11196:Bronze|7F5405|m
AK11198:Burnt Tin|331702|m
AK11201:Cobalt Blue|012136|m
AK11197:Copper|BD500B|m
AK11208:Dark Aluminium|787878|m
AK11204:Emerald Metallic Green|21753A|m
AK11203:Foundry Red|C53733|m
AK11191:Gold|9E6806|m
AK11212:Gun Metal|4E4E4C|m
AK11199:Metallic Blue|829C99|m
AK11210:Natural Steel|A7A6A1|m
AK11211:Oily Steel|A7A491|m
AK11192:Old Gold|B89402|m
AK11206:Pearl|F5EFD5|m
AK11195:Rusty Brass|A04D0B|m
AK11193:Rusty Gold|734B03|m
AK11209:Silver|A0AAAC|m
`
  },
  {
    brand: "AK",
    range: "3rd Gen Pastel",
    paints: `
AK11168:Pastel Blue|BDDDB8
AK11131:Pastel Green|A9D099
AK11076:Pastel Peach|F59A54
AK11059:Pastel Pink|F9C1AA
AK11069:Pastel Violet|FEE6F4
AK11037:Pastel Yellow|FDDA76
`
  },
  {
    brand: "AK",
    range: "3rd Gen Ink",
    paints: `
AK11229:Burnt Umber|1D1405
AK11223:Carbon Black|110801
AK11226:Dark Green|01663E
AK11225:Luminous Green|73B72C
AK11228:Night Blue|0B1C26
AK11227:Penetrating Red|B64026
AK11224:Purple|B47C89
AK11219:Sepia|230D00
AK11221:Skin|943718
AK11222:Sooty Black|5F5D48
AK11230:Titanium White|FFFFFF
AK11220:Turquoise|005E5E
`
  }
];
