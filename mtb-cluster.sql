/*
 Navicat Premium Data Transfer

 Source Server         : DATABASE_125
 Source Server Type    : MySQL
 Source Server Version : 80011
 Source Host           : 203.157.103.125:3306
 Source Schema         : mtb-cluster

 Target Server Type    : MySQL
 Target Server Version : 80011
 File Encoding         : 65001

 Date: 23/02/2026 09:40:48
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL COMMENT 'เช่น LOGIN_SUCCESS, LOGIN_FAILED, UPLOAD_FILE',
  `details` text COMMENT 'รายละเอียดเพิ่มเติม/ชื่อไฟล์',
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for district
-- ----------------------------
DROP TABLE IF EXISTS `district`;
CREATE TABLE `district` (
  `adm2_name` varchar(255) DEFAULT NULL,
  `adm2_name1` varchar(255) DEFAULT NULL,
  `adm2_name2` varchar(255) DEFAULT NULL,
  `adm2_name3` varchar(255) DEFAULT NULL,
  `adm2_pcode` varchar(255) NOT NULL,
  `adm1_name` varchar(255) DEFAULT NULL,
  `adm1_name1` varchar(255) DEFAULT NULL,
  `adm1_name2` varchar(255) DEFAULT NULL,
  `adm1_name3` varchar(255) DEFAULT NULL,
  `adm1_pcode` varchar(255) DEFAULT NULL,
  `adm0_name` varchar(255) DEFAULT NULL,
  `adm0_name1` varchar(255) DEFAULT NULL,
  `adm0_name2` varchar(255) DEFAULT NULL,
  `adm0_name3` varchar(255) DEFAULT NULL,
  `adm0_pcode` varchar(255) DEFAULT NULL,
  `valid_on` varchar(255) DEFAULT NULL,
  `valid_to` varchar(255) DEFAULT NULL,
  `area_sqkm` varchar(255) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `lang` varchar(255) DEFAULT NULL,
  `lang1` varchar(255) DEFAULT NULL,
  `lang2` varchar(255) DEFAULT NULL,
  `lang3` varchar(255) DEFAULT NULL,
  `adm2_ref_name` varchar(255) DEFAULT NULL,
  `center_lat` varchar(255) DEFAULT NULL,
  `center_lon` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`adm2_pcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for pipeline_runs
-- ----------------------------
DROP TABLE IF EXISTS `pipeline_runs`;
CREATE TABLE `pipeline_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(64) NOT NULL,
  `run_id` varchar(128) NOT NULL,
  `status` varchar(16) NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `engine_root` varchar(1024) NOT NULL,
  `dest_run_dir` varchar(1024) NOT NULL,
  `user_email` varchar(255) DEFAULT NULL,
  `user_label` varchar(255) DEFAULT NULL,
  `requested_ip` varchar(64) DEFAULT NULL,
  `exit_code` int(11) DEFAULT NULL,
  `exit_signal` varchar(32) DEFAULT NULL,
  `error_message` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pipeline_runs_run_id_unique` (`run_id`),
  KEY `pipeline_runs_status_index` (`status`),
  KEY `pipeline_runs_status_requested_at_index` (`status`,`requested_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for province
-- ----------------------------
DROP TABLE IF EXISTS `province`;
CREATE TABLE `province` (
  `adm1_name` varchar(255) DEFAULT NULL,
  `adm1_name1` varchar(255) DEFAULT NULL,
  `adm1_name2` varchar(255) DEFAULT NULL,
  `adm1_name3` varchar(255) DEFAULT NULL,
  `adm1_pcode` varchar(255) NOT NULL,
  `adm0_name` varchar(255) DEFAULT NULL,
  `adm0_name1` varchar(255) DEFAULT NULL,
  `adm0_name2` varchar(255) DEFAULT NULL,
  `adm0_name3` varchar(255) DEFAULT NULL,
  `adm0_pcode` varchar(255) DEFAULT NULL,
  `valid_on` varchar(255) DEFAULT NULL,
  `valid_to` varchar(255) DEFAULT NULL,
  `area_sqkm` varchar(255) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `lang` varchar(255) DEFAULT NULL,
  `lang1` varchar(255) DEFAULT NULL,
  `lang2` varchar(255) DEFAULT NULL,
  `lang3` varchar(255) DEFAULT NULL,
  `adm1_ref_name` varchar(255) DEFAULT NULL,
  `center_lat` varchar(255) DEFAULT NULL,
  `center_lon` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`adm1_pcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `lastname` varchar(255) DEFAULT NULL,
  `username` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `is_active` enum('Y','N') DEFAULT 'Y',
  `failed_login_attempts` int(11) DEFAULT '0',
  `lock_until` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('ADMIN','UPLOADER','VIEWER') DEFAULT 'VIEWER',
  PRIMARY KEY (`id`,`username`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8;

SET FOREIGN_KEY_CHECKS = 1;
