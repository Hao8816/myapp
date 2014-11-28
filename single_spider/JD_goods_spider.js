// 定义搜索的一些关键词

var JD_download = require('./JD_image_spider');
var http = require('http');
var redis = require('redis');
var client =  redis.createClient();
// 解决nodejs不支持gbk编码的问题
var iconv = require('iconv-lite');


// 定义buffer对象来存储返回的数据

// 当前是显示手机页面的链接
var basic_url = 'http://list.jd.com/list.html?cat=9987,653,655';
for (var i=0;i<3;i++){
    var buffer_list = [];
    var goods_url = basic_url + '&page='+i+'&JL=6_0_0';
    http.get(goods_url,function(res){
        res.on('data',function(data){
            buffer_list.push(data);
            //console.log(data);
        }).on('end',function(){
            var new_buffer = Buffer.concat(buffer_list);
            getJDGoodsData(new_buffer);
            console.log('success')
        }).on('error',function(err){
            console.error('can not get response from JD');
        })
    }).on('error',function(e){
        console.error('can not request JD');
    });
}


function getJDGoodsData(data) {
    //var decode_string = iconv.decode(data, 'GBK');
    var decode_string = data;
    //console.log(data.toString())
    var env = require('jsdom').env;
    // 设置html环境
    env(decode_string.toString(), function (errors, window) {
        var $ = require('jquery')(window);

        // 获取当前页面的列表数据和图片链接
        var goods_list = $('.list-h').find('li');
        console.log(goods_list.length);
        var image_url_list = [];
        var goods_info_list = [];
        var goods_sku_list = [];
        for (var i = 0; i < goods_list.length; i++) {
            var goods_info = {};
            var goods_sku_id = $(goods_list[i]).attr('sku');
            var goods_url = $(goods_list[i]).find('.lh-wrap .p-img a').attr('href');
            var image_url = $(goods_list[i]).find('.lh-wrap .p-img img').attr('data-lazyload');
            //var goods_desc = $(goods_list[i]).find('.p-name a').attr('title');
            //console.log($(goods_list[i]).find('.p-price').html());
            //console.log($(goods_list[i]).find('.p-name a').html())
            var goods_desc = $(goods_list[i]).find('.lh-wrap .p-name').find('a').text();
            // 这样的方式取得不了价格
            var goods_price = $(goods_list[i]).find('.p-price').text();
            if (typeof(image_url) == 'undefined'){
                continue;
            }
            goods_info['goods_sku_id'] = goods_sku_id;
            goods_info['goods_url'] = goods_url;
            goods_info['image_url'] = image_url;
            goods_info['goods_desc'] = goods_desc;
            goods_info_list.push(goods_info);
            image_url_list.push(image_url);
            goods_sku_list.push(goods_sku_id);
        }
        //console.log(goods_info_list);
        var script_list = $('script');
        var area_id = '';
        for (var s=0;s<script_list.length;s++){
            if($(script_list[s]).text().indexOf('var params =')>=0){
                var care_params = $(script_list[s]).text().split('var')[1];
                care_params = care_params.replace('params = ','');
                care_params = care_params.replace(';','');
                var area_json = JSON.parse(care_params);
                //console.log(area_json);
                if (area_json.hasOwnProperty('area')){
                    area_id = area_json['area'];
                }
            }
        }
        if(area_id != ''){
            getJDGoodsPrice(goods_sku_list,area_id);
        }
        // 取得网页里面的script信息，取得获取价格的
        //cacheJDImageList(image_url_list);
    });
}

function cacheJDImageList(url_list){
    url_list.forEach(function(obj){
        JD_download.JD_image_download(obj);
        client.lpush('JD_GOODS_IMAGE_LIST',obj,function(err){
            if(err){
                console.log(err);
            }
        })
    })
}


function getJDGoodsPrice(goods_sku_list,area_key){
    console.log(area_key);
    var area = area_key.replace(',','_');
    var price_list_buffer = [];
    http.get('http://p.3.cn/prices/mgets?skuIds=J_' + goods_sku_list.join(',J_') + '&type=1&area=' + area ,function(res){
        res.on('data',function(data){
            console.log(data);
            price_list_buffer.push(data);
        }).on('end',function(){
            var new_buffer = Buffer.concat(price_list_buffer);
            pickJDGoodsPrice(new_buffer);
        }).on('error',function(err){
            console.log(err)
        });
    });
}


var goods_JD_price_dic = {};
var goods_MK_price_dic = {};
function pickJDGoodsPrice(price_list){
    var price_json_list = JSON.parse(price_list);
    price_json_list.forEach(function(obj){
       goods_JD_price_dic[obj['id']] = obj['p'];
       goods_MK_price_dic[obj['id']] = obj['m'];
    });
    console.log(goods_JD_price_dic);
    console.log(goods_MK_price_dic);
}