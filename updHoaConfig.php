<?php
/*==============================================================================
 * (C) Copyright 2015 John J Kauflin, All rights reserved. 
 *----------------------------------------------------------------------------
 * DESCRIPTION: 
 *----------------------------------------------------------------------------
 * Modification History
 * 2015-03-06 JJK 	Initial version to get data 
 * 2015-10-01 JJK	Added insert new owner logic
 *============================================================================*/
	include 'commonUtil.php';
	// Include table record classes and db connection parameters
	include 'hoaDbCommon.php';

	header("Content-Type: application/json; charset=UTF-8");
	# Get JSON as a string
	$json_str = file_get_contents('php://input');

	# Decode the string to get a JSON object
	$param = json_decode($json_str);

	//error_log(date('[Y-m-d H:i] '). "updHoaConfig, action = " . $param->action . PHP_EOL, 3, "hoadb.log");
	//error_log(date('[Y-m-d H:i] '). "updHoaConfig, ConfigName = " . $param->ConfigName . PHP_EOL, 3, "hoadb.log");
	//error_log(date('[Y-m-d H:i] '). "updHoaConfig, ConfigDesc = " . $param->ConfigDesc . PHP_EOL, 3, "hoadb.log");
	//error_log(date('[Y-m-d H:i] '). "updHoaConfig, ConfigValue = " . $param->ConfigValue . PHP_EOL, 3, "hoadb.log");

	//--------------------------------------------------------------------------------------------------------
	// Create connection to the database
	//--------------------------------------------------------------------------------------------------------
	$conn = getConn();

	$sql = "SELECT * FROM hoa_config WHERE ConfigName = ? ";
	$stmt = $conn->prepare($sql);
	$stmt->bind_param("s", $param->ConfigName);
	
	$stmt->execute();
	$result = $stmt->get_result();
	$stmt->close();
	
	// If record found UPDATE, else INSERT
	if ($result->num_rows > 0) {
		$result->close();
		if ($param->action == 'Delete') {
			$stmt = $conn->prepare("DELETE FROM hoa_config WHERE ConfigName = ? ; ");
			$stmt->bind_param("s",$param->ConfigName);
		} else {
			$stmt = $conn->prepare("UPDATE hoa_config SET ConfigDesc=?,ConfigValue=? WHERE ConfigName = ? ; ");
			$stmt->bind_param("sss",$param->ConfigDesc,$param->ConfigValue,$param->ConfigName);
		}
	} else {
		$result->close();
		$sqlStr = 'INSERT INTO hoa_config (ConfigName,ConfigDesc,ConfigValue) VALUES(?,?,?); ';
		$stmt = $conn->prepare($sqlStr);
		$stmt->bind_param("sss",$param->ConfigName,$param->ConfigDesc,$param->ConfigValue);
	}
	$stmt->execute();
	$stmt->close();

	// Re-query the list and pass it back for display
	$sql = "SELECT * FROM hoa_config ORDER BY ConfigName ";
	$stmt = $conn->prepare($sql);
	$stmt->execute();
	$result = $stmt->get_result();
	$outputArray = array();
	if ($result != NULL) {
		while($row = $result->fetch_assoc()) {
			array_push($outputArray,$row);
		}
	}
	$stmt->close();

	$conn->close();
	echo json_encode($outputArray);
?>

