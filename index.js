/* jshint node: true */
'use strict';

var through = require('through2'),
    cheerio = require("cheerio");

module.exports = function(baseUri, options) {
    baseUri = baseUri || 'http://mc.meituan.net/combo/?f=';
    options = options || {};

    return through.obj(function(file, enc, cb) {
        var chunk = String(file.contents);
        var src = {
            scripts: [],
            links: []
        };

        var genComboScriptUriTag = function() {
            var uri = baseUri + src.scripts.join(options.splitter || ';');
            var scriptTag = '<script type="text/javascript" src="' + uri + '"></script>';
            var async = options.async || false;

            if(chunk.match('<!--combo async:false-->')) {
                async = false;
            }

            if(chunk.match('<!--combo async:true-->')) {
                async = true;
            }

            if(async === true) {
                  scriptTag = '<script type="text/javascript" src="' + uri + '" async="async"></script>';
            }

            return scriptTag;
        };

        var genComboLinkUriTag = function() {
            var uri = baseUri + src.links.join(options.splitter || ';');
            var linkTag = '<link rel="stylesheet" href="' + uri + '" />';
            return linkTag;
        };

        var group = (chunk.replace(/[\r\n]/g, '').match(/<\!\-\-\[if[^\]]+\]>.*?<\!\[endif\]\-\->/igm) || []).join('');

        /*
         * 增加忽略属性避免条件注释或者模板条件判断中的资源被合并
         * 自动忽略if ie条件注释
         */
        var isIgnore = function(str) {
            if(str.match('data-ignore="true"') || (group && group.indexOf(str) !== -1)) {
                return true;
            }

            return false;
        };

        var scriptProcessor = function($, $1) {
            if(isIgnore($)) {
                return $;
            }

            if($.match(/http:\/\//igm)) {
                if($1.match(/^http:\/\/mc.meituan.net\//igm)) {
                    src.scripts.push($1.replace('http://mc.meituan.net/', ''));
                } else {
                    return $;
                }
            } else {
                src.scripts.push($1.replace(/(.+\/)?[^\/]+\/\.\.\//igm, '$1'));
            }

            if(src.scripts.length === 1) {
                return '<%%%SCRIPT_HOLDER%%%>';
            }

            return '';
        };

        var linkProcessor = function($, $1) {
            if(isIgnore($)) {
                return $;
            }

            if($.match(/http:\/\//igm)) {
                if($1.match(/^http:\/\/mc.meituan.net\//igm)) {
                    src.links.push($1.replace('http://mc.meituan.net/', ''));
                } else {
                    return $;
                }
            } else {
                src.links.push($1.replace(/(.+\/)?[^\/]+\/\.\.\//igm, '$1'));
            }

            if(src.links.length === 1) {
                return '<%%%STYLES_HOLDER%%%>';
            }

            return '';
        };


        chunk = chunk.replace(/<script[^>]+?src="([^"]+)"[^>]*><\/script>/igm, scriptProcessor);
        chunk = chunk.replace(/<link[^>]+?href="([^"]+?)"[^>]+?rel="stylesheet"[^>]*>/igm, linkProcessor);
        chunk = chunk.replace(/<link[^>]+?rel="stylesheet"[^>]+?href="([^"]+?)"[^>]*>/igm, linkProcessor);

        chunk = chunk.replace('<%%%SCRIPT_HOLDER%%%>', genComboScriptUriTag());
        chunk = chunk.replace('<%%%STYLES_HOLDER%%%>', genComboLinkUriTag());
        file.contents = new Buffer(chunk);
        cb(null, file);
    });
};
