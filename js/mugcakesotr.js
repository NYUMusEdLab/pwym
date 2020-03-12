/* global $,Miso,JST */
$(function(){

  var cakes = new Miso.Dataset({
    importer : Miso.Dataset.Importers.GoogleSpreadsheet,
    parser : Miso.Dataset.Parsers.GoogleSpreadsheet,
    key: "1MASuPd2ljD3STzSgDYs5P4bz6yj_1jaapYEY6ZSq59A", /* PWYM mugcakes online teaching resources */
    worksheet: "1"
  });

  var workingColumns = [
    "Project",
    "Profile Link",
    "URL for Gallery"
  ];

  var $el = $("#cakes");
  cakes.fetch().done(function() {
    cakes.each(function(cake) {
       $el.append(JST["templates/cake.html"]({
         cake : cake,
         controls : workingColumns
       }));
    });
  });
}());
