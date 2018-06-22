// CodeMirror 4.1.1, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  //Apply function f on each element
  function forEach(arr, f) {
    for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]);
  }

  //Checks for occurrence of item, last to first in the array
  function arrayContains(arr, item) {
    if (!Array.prototype.indexOf) {
      var i = arr.length;
      while (i--) {
        if (arr[i] === item) {
          return true;
        }
      }
      return false;
    }
    return arr.indexOf(item) != -1;
  }

  function scriptHint(editor, _keywords, getToken, options) {
    // Find the token at the cursor
    var cur = editor.getCursor(), token = getToken(editor, cur), tprop = token;

    if (!context) var context = [];
    context.push(tprop);

    var completionList = getCompletions(token, context);
    //completionList = completionList.sort(); //sorting the completion list...might not need to do this

    //How far to look
    var WORD = /[\w$]+/, RANGE = 500;

    //Look at nearby words and add them to the list if hey are variables
    var word = options && options.word || WORD;
    var range = options && options.range || RANGE;
    var cur = editor.getCursor(), curLine = editor.getLine(cur.line);
    var end = cur.ch, start = end;
    while (start && word.test(curLine.charAt(start - 1))) --start;
    var curWord = start != end && curLine.slice(start, end);

    var list = completionList, seen = {};
    var re = new RegExp(word.source, "g");
    for (var dir = -1; dir <= 1; dir += 2) {
      var line = cur.line, endLine = Math.min(Math.max(line + dir * range, editor.firstLine()), editor.lastLine()) + dir;
      for (; line != endLine; line += dir) {
        var text = editor.getLine(line), m;
        while (m = re.exec(text)) {
          if (line == cur.line && m[0] === curWord) continue;
          if ((!curWord || m[0].lastIndexOf(curWord, 0) == 0) && !Object.prototype.hasOwnProperty.call(seen, m[0])) {
            seen[m[0]] = true;
            //make sure we only add nearby variables, not just any string (could also do this by checking token type)
            if(m[0].length > 0 && m[0].charAt(0) == "$") list.push(m[0]);
          }
        }
      }
    }

    return {list: list,
            from: CodeMirror.Pos(cur.line, token.start),
            to: CodeMirror.Pos(cur.line, token.end)};
  }

  function velocityHint(editor, options) {
    return scriptHint(editor, velocityKeywords,
                      function (e, cur) {return e.getTokenAt(cur);},
                      options);
  };
  CodeMirror.registerHelper("hint", "velocity", velocityHint);

  //Supported velocity strings
  var velocityKeywords = ("#end #else #break #stop #[[ #]] " +
                              "#{end} #{else} #{break} #{stop}").split(" ");
  var velocityFunctions = ("#if #elseif #foreach #set #include #parse #macro #define #evaluate " +
                               "#{if} #{elseif} #{foreach} #{set} #{include} #{parse} #{macro} #{define} #{evaluate}").split(" ");
  var velocitySpecials = ("$foreach.count $foreach.hasNext $foreach.first $foreach.last $foreach.topmost $foreach.parent.count $foreach.parent.hasNext $foreach.parent.first $foreach.parent.last $foreach.parent $velocityCount $!bodyContent $bodyContent").split(" ");  

  function getCompletions(token, context) {
    var found = [], start = token.string;
    function maybeAdd(str) {
      //See if start is the first character of the string, and add the string if its not already there
      if (str.lastIndexOf(start, 0) == 0 && !arrayContains(found, str)) found.push(str);
    }

    function gatherCompletions(_obj) {
        //try adding the supported string to the suggestion list if theyre valid
        forEach(velocityKeywords, maybeAdd);
        forEach(velocityFunctions, maybeAdd);
        forEach(velocitySpecials, maybeAdd);   
    }

    if (context) {
      // If this is a property, see if it belongs to some object we can
      // find in the current environment.
      var obj = context.pop(), base;
      base = obj.string;

      while (base != null && context.length)
        base = base[context.pop().string];
      if (base != null) gatherCompletions(base);
    }
    return found;
  }
});