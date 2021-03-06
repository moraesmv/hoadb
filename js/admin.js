/*==============================================================================
 * (C) Copyright 2015,2016,2017,2018 John J Kauflin, All rights reserved. 
 *----------------------------------------------------------------------------
 * DESCRIPTION: 
 *----------------------------------------------------------------------------
 * Modification History
 * 2015-03-06 JJK 	Initial version 
 * 2016-05-19 JJK   Modified to get the country web site URL's from config
 * 2016-06-05 JJK   Split Edit modal into 1 and 2Col versions
 * 2016-06-09 JJK	Added duesStatementNotes to the individual dues
 * 					statement and adjusted the format
 * 2016-06-24 JJK	Working on adminExecute (for yearly dues statement)
 * 2016-07-01 JJK	Got progress bar for adminExecute working by moving loop
 * 					processing into an asynchronous recursive function.
 * 2016-07-13 JJK   Finished intial version of yearly dues statements
 * 2016-07-14 JJK   Added Paid Dues Counts report
 * 2016-07-28 JJK	Corrected compound interest problem with a bad start date
 * 					Added print of LienComment after Total Due on Dues Statement
 * 2016-07-30 JJK   Changed the Yearly Dues Statues to just display prior
 * 					years due messages instead of amounts.
 * 					Added yearlyDuesStatementNotice for 2nd notice message.
 * 					Added DateDue to CSV for reports
 * 2016-08-19 JJK	Added UseMail to properties and EmailAddr to owners
 * 2016-08-20 JJK	Implemented email validation check
 * 2016-08-26 JJK   Went live, and Paypal payments working in Prod!!!
 * 2017-08-13 JJK	Added a dues email test function, and use of payment
 * 					email for dues statements
 * 2017-08-18 JJK   Added an unsubscribe message to the dues email
 * 2017-08-19 JJK   Added yearly dues statement notice and notes different
 * 					for 1st and Additional notices
 * 2017-08-20 JJK   Added Mark notice mailed function and finished up
 *                  Email logic.
 * 					Added logic to set NoticeDate
 * 2018-01-21 JJK	Corrected set of default firstNotice to false (so 2nd
 * 					notices would correctly use the alternate notes)
 * 2018-10-14 JJK   Re-factored for modules
 * 2018-11-03 JJK   Got update Properties working again with JSON POST
 * 2018-11-04 JJK   (Jackson's 16th birthday)
 * 2018-11-17 JJK   To solve the async loop issue I modified AdminRequest to 
 *                  do all data queries in the PHP module and pass back a 
 *                  large array of data to process in a sync loop
 * 2018-11-25 JJK   Renamed to pdfModule and implemented configuration object
 *                  rather than global variables (to solve email issue)
 * 2018-11-26 JJK   Implemented error handling and logging for failed 
 *                  email sends
 * 2019-09-14 JJK   Added a FirstNoticeCheckbox for explicit designation
 *                  of 1st or Additional notices.  Pass along and use in
 *                  the functions instead of comparing array count with 
 *                  total number of properties
 * 2019-09-22 JJK   Checked logic for dues emails and communications
 * 2020-02-15 JJK   For the dues emails, adding display list of records
 *                  (for both test and real) to confirm logic
 *                  Fixed the bug that was getting string 'false' value 
 *                  instead of boolean false
 *============================================================================*/
var admin = (function () {
    'use strict';  // Force declaration of variables before use (among other things)

    //=================================================================================================================
    // Private variables for the Module

    //=================================================================================================================
    // Variables cached from the DOM
    var $document = $(document);
    var $moduleDiv = $('#AdminPage');
    // Figure out a better way to do this
    //var $displayPage = $document.find('#navbar a[href="#AdminPage"]');
    var $DuesAmt = $moduleDiv.find("#DuesAmt");
    var $FiscalYear = $moduleDiv.find("#FiscalYear");
    var $ConfirmationModal = $document.find("#ConfirmationModal");
    var $ConfirmationButton = $ConfirmationModal.find("#ConfirmationButton");
    var $ConfirmationMessage = $ConfirmationModal.find("#ConfirmationMessage");
    var $ResultMessage = $moduleDiv.find("#ResultMessage");
    var $FirstNoticeCheckbox = $moduleDiv.find("#FirstNoticeCheckbox");

    //=================================================================================================================
    // Bind events
    $moduleDiv.on("click", ".AdminButton", _adminRequest);
    $ConfirmationButton.on("click", "#AdminExecute", _adminExecute);
    
    //=================================================================================================================
    // Module methods
    function _adminRequest(event) {
        var firstNotice = true;
        if (!$FirstNoticeCheckbox.prop('checked')) {
            //console.log("FirstNoticeCheckbox NOT CHECKED ");
            firstNotice = false;
        }

        // Validate add assessments (check access permissions, timing, year, and amount)
        // get confirmation message back
        var fy = util.cleanStr($FiscalYear.val());
        var duesAmt = util.cleanStr($DuesAmt.val());
        util.waitCursor();
        $.getJSON("adminValidate.php", "action=" + event.target.getAttribute('id') +
            "&fy=" + fy +
            "&duesAmt=" + duesAmt, function (adminRec) {
            $ConfirmationMessage.html(adminRec.message);
            $ConfirmationButton.empty();
            var buttonForm = $('<form>').prop('class', "form-inline").attr('role', "form");
            // If the action was Valid, append an action button
            if (adminRec.result == "Valid") {
                buttonForm.append($('<button>').prop('id', "AdminExecute").prop('class', "btn btn-danger").attr('type', "button").attr('data-dismiss', "modal").html('Continue')
                    .attr('data-action', event.target.getAttribute('id')).attr('data-fy', fy).attr('data-duesAmt', duesAmt).attr('data-firstNotice', firstNotice));
            }
            buttonForm.append($('<button>').prop('class', "btn btn-default").attr('type', "button").attr('data-dismiss', "modal").html('Close'));
            $ConfirmationButton.append(buttonForm);
            util.defaultCursor();
            $ConfirmationModal.modal();
        });
    }

    // Respond to the Continue click for an Admin Execute function 
    function _adminExecute(event) {
        $ResultMessage.html("Executing Admin request...(please wait)");
        util.waitCursor();
        var action = event.target.getAttribute("data-action");
        var firstNotice = true;
        // 2/15/2020 JJK - fixed the bug that was getting string 'false' value instead of boolean false
        if (event.target.getAttribute("data-firstNotice") == "false") {
            firstNotice = false;
        }

        //console.log("in adminExecute, action = "+action);
        //console.log("in adminExecute, firstNotice = "+firstNotice);

        // Get all the data needed for processing
        $.getJSON("adminExecute.php", "action=" + action +
            "&fy=" + event.target.getAttribute("data-fy") +
            "&duesAmt=" + event.target.getAttribute("data-duesAmt") + 
            "&duesEmailTestParcel=" + config.getVal('duesEmailTestParcel'), function (adminRec) {
            util.defaultCursor();
            $ResultMessage.html(adminRec.message);

            if (action == 'DuesNotices') {
                _duesNotices(adminRec.hoaRecList,firstNotice);
            } else if (action == 'MarkMailed') {
                _markMailed(adminRec.hoaRecList,firstNotice);
            } else if (action == 'DuesEmails' || action == 'DuesEmailsTest') {
                _duesEmails(adminRec.hoaRecList,action,firstNotice);
            }

        }); // $.getJSON("adminExecute.php","action="+action+
    }

    function _duesNotices(hoaRecList,firstNotice) {
        var adminEmailSkipCnt = 0;
        var duesNoticeCnt = 0;
        var displayAddress = '';
        var commType = 'Dues Notice';
        var commDesc = '';
        var noticeType = "1st";
        if (!firstNotice) {
            noticeType = 'Additional';
        }

        // Create a pdfRec and initialize the PDF object
        var pdfRec = pdfModule.init('Member Dues Notice');

        //console.log("_duesNotices, Before adminLoop, hoaRecList.length = " + hoaRecList.length);
        $ResultMessage.html("Executing Admin request...(processing list)");

        $.each(hoaRecList, function (index, hoaRec) {
            //console.log(index + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1 + ", hoaRec.DuesEmailAddr = " + hoaRec.DuesEmailAddr);
            // When generating DuesNotices for the 1st notice, skip the ones with Property UseEmail set (if there is a valid email)
            if (firstNotice && hoaRec.UseEmail && hoaRec.DuesEmailAddr != '') {
                adminEmailSkipCnt++;
            } else {
                duesNoticeCnt++;
                if (index > 0) {
                    // If not the first record for DuesNotices, then add a new page for the next parcel
                    pdfRec = pdfModule.addPage(pdfRec);
                }
                // Call function to format the yearly dues statement for an individual property
                pdfRec = pdfModule.formatYearlyDuesStatement(pdfRec, hoaRec, firstNotice);

                // Get a displayAddress for the Communication record
                displayAddress = hoaRec.Parcel_Location;
                if (hoaRec.ownersList[0].AlternateMailing) {
                    displayAddress = hoaRec.ownersList[0].Alt_Address_Line1;
                }
                commDesc = noticeType + " Notice for postal mail created for " + displayAddress;
                // log communication for notice created
                communications.LogCommunication(hoaRec.Parcel_ID, hoaRec.ownersList[0].OwnerID, commType, commDesc);
            }
        }); // End of loop through Parcels

        $("#ResultMessage").html("Yearly dues notices created, total = " + duesNoticeCnt + ", (Total skipped for UseEmail = " + adminEmailSkipCnt + ")");
        // Download the PDF file
        pdfRec.pdf.save(util.formatDate() + "-YearlyDuesNotices.pdf");
    }

    function _markMailed(hoaRecList,firstNotice) {
        var adminEmailSkipCnt = 0;
        var markMailedCnt = 0;
        var displayAddress = '';
        var commType = 'Dues Notice';
        var commDesc = '';

        $ResultMessage.html("Executing Admin request...(processing list)");

        $.each(hoaRecList, function (index, hoaRec) {
            if (firstNotice && hoaRec.UseEmail && hoaRec.DuesEmailAddr != '') {
                adminEmailSkipCnt++;
            } else {
                markMailedCnt++;
                // Get a displayAddress for the Communication record
                displayAddress = hoaRec.Parcel_Location;
                if (hoaRec.ownersList[0].AlternateMailing) {
                    displayAddress = hoaRec.ownersList[0].Alt_Address_Line1;
                }

                commDesc = "Notice for postal mail mailed for " + displayAddress;
                // log communication for notice created
                communications.LogCommunication(hoaRec.Parcel_ID, hoaRec.ownersList[0].OwnerID, commType, commDesc);
            }

        }); // End of loop through Parcels

        $ResultMessage.html("Postal dues notices marked mailed, total = " + markMailedCnt + ", (Total skipped for UseEmail = " + adminEmailSkipCnt + ")");
    }

    function _duesEmails(hoaRecList,action,firstNotice) {
        var emailRecCnt = 0;
        var commType = 'Dues Notice Email';
        var commDesc = '';
        var sendEmailAddr = '';
        var noticeType = "1st";
        if (!firstNotice) {
            noticeType = "Additional";
        }

        $ResultMessage.html("Executing Admin request...(processing list)");

        var firstTestRec = true;
        var testEmailAddr = config.getVal('duesEmailTestAddress');
        var resultDetails = '';
        var pdfRec;
        $.each(hoaRecList, function (index, hoaRec) {
            //console.log(index + ", len = " + hoaRec.emailAddrList.length + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1);

            // If there is an email address for this property, then create the dues notice attachment (to send to all email addresses for this property)
            if (hoaRec.emailAddrList.length > 0) {
                emailRecCnt++;
                //console.log(index + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1);
                // Create a pdfRec and initialize the PDF object
                pdfRec = pdfModule.init('Member Dues Notice');
                // Call function to format the yearly dues statement for an individual property
                pdfRec = pdfModule.formatYearlyDuesStatement(pdfRec, hoaRec, firstNotice);
            }

            // loop through email address list and send to each one
            $.each(hoaRec.emailAddrList, function (index2, emailAddr) {
                sendEmailAddr = emailAddr;

                if (action == 'DuesEmailsTest') {
                    // This is a Test
                    //console.log(index + " " + index2 + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1 + ", emailAddr = " + emailAddr);
                    resultDetails = resultDetails + "<br>" + index + " " + index2 + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " 
                        + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1 + " " 
                        + hoaRec.ownersList[0].Owner_Name2 + ", emailAddr = " + emailAddr;

                    if (firstTestRec) {
                        firstTestRec = false;
                        $.post("sendMail.php", {
                            toEmail: testEmailAddr,
                            subject: config.getVal('hoaNameShort') + ' Dues Notice',
                            messageStr: 'Attached is the ' + config.getVal('hoaName') + ' Dues Notice.  *** Reply to this email to request unsubscribe ***',
                            parcelId: hoaRec.Parcel_ID,
                            ownerId: hoaRec.ownersList[0].OwnerID,
                            filename: config.getVal('hoaNameShort') + 'DuesNotice.pdf',
                            filedata: btoa(pdfRec.pdf.output())
                        }, function (response) {
                            console.log("result from sendMail = " + response.result + ", ParcelId = " + response.Parcel_ID + ", OwnerId = " + response.OwnerID + ", response.sendEmailAddr = " + response.sendEmailAddr);
                        }, 'json'); // End of $.post("sendMail.php"
                    }

                } else {
                    //  This is NOT a Test
                    //console.log(index + " " + index2 + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = " + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1 + ", sendEmailAddr = " + sendEmailAddr);
                    resultDetails = resultDetails + "<br>" + index + " " + index2 + ", ParcelId = " + hoaRec.Parcel_ID + ", OwnerID = "
                        + hoaRec.ownersList[0].OwnerID + ", Owner = " + hoaRec.ownersList[0].Owner_Name1 + " "
                        + hoaRec.ownersList[0].Owner_Name2 + ", emailAddr = " + emailAddr;

                    $.post("sendMail.php", {
                        toEmail: sendEmailAddr,
                        subject: config.getVal('hoaNameShort') + ' Dues Notice',
                        messageStr: 'Attached is the ' + config.getVal('hoaName') + ' Dues Notice.  *** Reply to this email to request unsubscribe ***',
                        parcelId: hoaRec.Parcel_ID,
                        ownerId: hoaRec.ownersList[0].OwnerID,
                        filename: config.getVal('hoaNameShort') + 'DuesNotice.pdf',
                        filedata: btoa(pdfRec.pdf.output())
                    }, function (response) {
                        //console.log("result from sendMail = " + response.result + ", ParcelId = " + response.Parcel_ID + ", OwnerId = " + response.OwnerID + ", response.sendEmailAddr = " + response.sendEmailAddr);
                        if (response.result == 'SUCCESS') {
                            commDesc = noticeType + " Dues Notice emailed to " + response.sendEmailAddr;
                        } else {
                            commDesc = noticeType + " Dues Notice, ERROR emailing to " + response.sendEmailAddr;
                            util.displayError(commDesc + ", ParcelId = " + response.Parcel_ID + ", OwnerId = " + response.OwnerID);
                            console.log("Error sending Email, ParcelId = " + response.Parcel_ID + ", OwnerId = " + response.OwnerID + ", sendEmailAddr = " + response.sendEmailAddr + ", message = " + response.message);
                        }
                        // log communication for notice created
                        communications.LogCommunication(response.Parcel_ID, response.OwnerID, commType, commDesc);
                    }, 'json'); // End of $.post("sendMail.php"
                    
                }

            }); // End of loop through Email addresses
            
        }); // End of loop through Parcels

        if (action == 'DuesEmailsTest') {
            $("#ResultMessage").html("TEST Yearly dues notices emailed, total = " + emailRecCnt + "<br>" + resultDetails);
        } else {
            $("#ResultMessage").html("Yearly dues notices emailed, total = " + emailRecCnt + "<br>" + resultDetails);
        }
    }

    //=================================================================================================================
    // This is what is exposed from this Module
    return {
    };

})(); // var admin = (function(){
