// ==UserScript==
// @name        Naturalgrimoire
// @namespace   fr.kergoz-panic.watilin
// @description Propose différentes façons de trier les recettes du grimoire
// @version     0.1
//
// @include     http://www.naturalchimie.com/book
// @include     http://www.naturalchimie.com/book#
//
// @resource    style   ./style.css
//
// @grant       GM_getResourceText
// @run-at      document-start
// @noframes
// @nocompat
//
// @copyright   2015, Watilin
// @license     MIT; https://github.com/Watilin/Naturalgrimoire/raw/master/LICENSE
// @homepageURL https://github.com/Watilin/Naturalgrimoire
// @supportURL  https://github.com/Watilin/Naturalgrimoire/issues
// @downloadURL https://raw.githubusercontent.com/Watilin/Naturalgrimoire/master/naturalgrimoire.user.js
// @updateURL   https://raw.githubusercontent.com/Watilin/Naturalgrimoire/master/naturalgrimoire.meta.js
// @oujs:author Watilin
// ==/UserScript==

"use strict";

/* Table Of Contents: Use Ctrl+F and start with “@”, example: “@POL”
 *  [POL] Polyfill For Chrome
 *  [FUN] Function Declarations
 *  [STY] Style Injection
 *  [DOM] DOM Insertion
 */

// [@POL] Polyfill For Chrome //////////////////////////////////////////

["forEach", "map", "reduce", "slice", "filter"]
  .forEach(function(method) {
    if (!(method in Array)) {
      Array[method] = function(collection, callback) {
        return Array.prototype[method].call(collection, callback);
      };
    }
  });

// [@FUN] Function Declarations ////////////////////////////////////////

/**
  @param $objQte {HTMLElement} a <span class="obQte"> from the page
  @return {Number} the quantity displayed by the images within $objQte
*/
function fetchQuantity($objQte) {
  return parseInt(Array.reduce(
    $objQte.getElementsByTagName("img"),
    function(str, $img) { return str + $img.alt; },
    ""
  ), 10);
}

/**
  @return {Array} an array of objects containing information about each
recipe found in the page
*/
function fetchRecipes() {
  var recipes = [];

  /* div[id^='right_'] -> code
       img               -> category
       .aRecipe
         embed             -> name
         .rNfo             -> school, rank
         .odesc            -> description
       .therecette
         .ingr             -> ingredients
         .res              -> type, result
       .forbiddenRec     -> forbidden
     #r_{code}_canDoIt -> feasible
  */
  Array.forEach(document.querySelectorAll("div[id^='right_']"),
    function($bigRecipe) {
      var infos = {};

      // retrieves the code
      infos.code = $bigRecipe.id.match(/^right_(.+)$/)[1];

      // retrieves the category
      var shortCatNames = [
        "El", // (0) Élémentaire
        "Co", // (1) Cosmétique
        "IP", // (2) Inutilité publique
        "Ve", // (3) Vestimentaire
        "CA"  // (4) Combat Alchimique
      ];
      var $titleImg = $bigRecipe.querySelector("img");
      infos.category = shortCatNames[
        $titleImg.src.match(/\/grim_title_(\d)\.jpg$/)[1]
      ];

      var $aRecipe = $bigRecipe.querySelector(".aRecipe");

      // retrieves the name
      var $recipeName = $aRecipe.querySelector("embed");
      infos.name = $recipeName.id.match(/^recipebig_(.+)$/)[1];

      // retrieves the school/Guild
      var $rNfo = $aRecipe.querySelector(".rNfo");
      var $schoolImg = $rNfo.querySelector("img");
      infos.school = $schoolImg.alt;
      infos.schoolIcon = $schoolImg.src;

      // retrieves the rank
      var $rankImg = $rNfo.querySelector("span[id] img");
      infos.rank = $rankImg.src.match(/\/rank_(\d)\.jpg$/)[1];
      infos.rankIcon = $rankImg.src;

      // retrieves the description
      infos.description = $aRecipe.querySelector(".odesc")
        .textContent.trim();

      var $therecette = $bigRecipe.querySelector(".therecette");

      // retrieves the ingredients list
      var $ingr = $therecette.querySelector(".ingr");
      infos.ingredients = Array.reduce(
        $ingr.getElementsByClassName("obj"),
        function(ingredients, $obj) {
          var $objImg = $obj.querySelector(".objImg");
          ingredients.push({
                name: $objImg.alt,
                code: $objImg.src.match(/\/([^./]+)\.png$/)[1],
            quantity: fetchQuantity($obj.querySelector(".objQte"))
          });
          return ingredients;
        },
        []
      );

      // retrieves the type, it's hidden in a comment node
      var $res = $therecette.querySelector(".res");
      var $next = $res.querySelector("h3").nextSibling;
      while ($next && $next.nodeType !== Node.COMMENT_NODE) {
        $next = $next.nextSibling;
      }
      var type = $next.data.trim();
      infos.type = type;

      // retrieves the result
      switch (type) {
        case "add":
          var $objImg = $res.querySelector(".objImg");
          infos.result = {
                name: $objImg.alt,
                code: $objImg.src.match(/\/([^./]+)\.png$/),
            quantity: fetchQuantity($res.querySelector(".objQte"))
          };
          break;

        case "avatar":
        case "avatarrand":
        case "win":
        case "smiley":
        case "keeperGoOut":
        case "color":
          console.log("recipe type '%s' is yet TODO", type);
          break;

        default:
          console.warn("recipe type '%s' has been oversighted!", type);
          break;
      }

      // retrieves the forbidden-ness
      infos.forbidden =
        null !== $bigRecipe.querySelector(".forbiddenRec");

      // retrieves the feasibility
      var $puce = document.querySelector("#r_" + infos.code +
                                         "_canDoIt img");
      infos.feasible =
        "tick" === $puce.src.match(/\/puce_(tick|fail)small\.gif$/)[1];

      recipes.push(infos);
    });

  return recipes;
}

// [@STY] Style Injection //////////////////////////////////////////////

// in case the <head> isn't ready, falls back to <html>
var $receiver = document.head || document.documentElement;

// imports some fonts from Google Web Fonts
[ "Pacifico", "Fondamento" ]
  .forEach(function(fontToImport) {
    var $fontLink = document.createElement("link");
    $fontLink.rel = "stylesheet";
    $fontLink.href = "http://fonts.googleapis.com/css?family=" +
      fontToImport.replace(/ /g, "+");
    $receiver.appendChild($fontLink);
  });

// injects the @resource style
var $style = document.createElement("style");
$style.textContent = GM_getResourceText("style");
$receiver.appendChild($style);

// [@DOM] DOM Insertion ////////////////////////////////////////////////

document.addEventListener("DOMContentLoaded", function() {
  // retrieves the game's main object
  var _js = unsafeWindow.js;

  // selects page elements
  var $menu = document.querySelector(".menu");
  var $grimoir = document.getElementById("grimoir");

  // inserts new contents
  $menu.insertAdjacentHTML("beforeend",
    "<a id='kpw-mainButton' href='#'>Trier les recettes</a>");
  $grimoir.insertAdjacentHTML("beforeend",
    "<div id='kpw-container' style='display: none;'>\
      <div class='page double'></div>\
      <div class='page left'  style='display: none'></div>\
      <div class='page right' style='display: none'></div>\
    </div>");

  // selects newly created elements
  var $mainButton = $menu.querySelector("#kpw-mainButton");
  var $container  = $grimoir.querySelector("#kpw-container");
  var $doublePage = $container.querySelector(".page.double");
  var $leftPage   = $container.querySelector(".page.left");
  var $rightPage  = $container.querySelector(".page.right");

  // hooks the new button
  var recipes;
  $mainButton.addEventListener("click", function(event) {
    event.preventDefault();
    _js.App.hideAllBook();
    $container.style.display = "";

    // creates and appends the recipe list upon the first click only
    if (recipes) return;

    recipes = fetchRecipes();
    var $ul = document.createElement("ul");
    recipes.forEach(function(recipe) {
      var $li = document.createElement("li");
      var $a = document.createElement("a");
      $a.href = "#";
      $a.title = recipe.description;
      $a.expandoRecipe = recipe;

      var $nameSpan = document.createElement("span");
      $nameSpan.textContent = recipe.name;
      $a.appendChild($nameSpan);

      var $schoolImg = document.createElement("img");
      $schoolImg.alt = recipe.school;
      $schoolImg.src = recipe.schoolIcon;
      $schoolImg.width = 16;
      $schoolImg.height = 16;
      $a.appendChild($schoolImg);

      var $rankImg = document.createElement("img");
      $rankImg.alt = recipe.rank;
      $rankImg.src = recipe.rankIcon;
      $rankImg.width = 16;
      $rankImg.height = 16;
      $a.appendChild($rankImg);

      $li.appendChild($a);
      $ul.appendChild($li);
    });

    $ul.addEventListener("click", function(event) {
      var $target = event.target;
      if ("A" !== event.target.tagName) return;
      event.preventDefault();

      var recipe = $target.expandoRecipe;
      console.log(recipe);
    });

    $doublePage.insertAdjacentHTML("beforeend",
      "<h3>Liste des recettes</h3>\
      <p>\
        Vous connaissez actuellement " + recipes.length + " recettes.\
      </p>\
      <!--svg width='0' height='0'>\
        <defs>\
          <linearGradient id='kpw-gradient' x2='0' y2='1'>\
            <stop stop-color='black' offset='0'/>\
            <stop stop-color='white' offset='0.5'/>\
            <stop stop-color='black' offset='1'/>\
          </linearGradient>\
          <mask id='kpw-mask' maskContentUnits='objectBoundingBox'>\
            <rect x='0' y='0' width='1' height='1'\
                  fill='url(#kpw-gradient)'/>\
          </mask>\
        </defs>\
      </svg-->");
    $doublePage.appendChild($ul);
  });

  // hooks existing buttons
  $menu.addEventListener("click", function(event) {
    var $target = event.target;
    if ("A" === $target.tagName && $target !== $mainButton) {
      $container.style.display = "none";
    }
  });
});
