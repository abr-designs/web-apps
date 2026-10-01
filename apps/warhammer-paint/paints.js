// Created by Claude (claude-opus-5-5)
// Date: 2026-09-30
//
// Built-in paint catalogue. Hex values are approximations of each paint's
// dried colour on a white basecoat (shades and contrasts show a mid-strength
// application). Format per line: "Name|hex" plus "|m" for metallics,
// optionally prefixed by a product code as "code:Name|hex".
// To add a collection permanently, append an entry to PAINT_COLLECTIONS.
//
// PAINT_BRANDS sets the badge shown on paint tags. "short" is the badge text
// and "color" its background. "logo" is optional: a path to an image in the
// logos folder (published with the page) that replaces the text badge. A logo
// that fails to load falls back to the text badge. Brands without an entry get
// initials and a generated colour.
window.PAINT_BRANDS = {
  Citadel: { short: "CIT", color: "#1F3A6B", logo: "logos/citadel.png" },
  Vallejo: { short: "VAL", color: "#9E1B1F", logo: "logos/vallejo.png" }
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
  }
];
