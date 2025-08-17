public String convertedHan (String Hangle, String hanFont, String engFont, String Pitch, String strKind) {
    String charHangule = null;                                      // 데이타파일에서 비교하기 위해 원은 1은자
    StringBuffer resultHangule = null;                              // .... Cenversion 한국 Hex:
    StringBuffer myString = new StringBuffer ();                    // Conversiong 한국 X값 계속 누적
    boolean HanFlag = false;                                        // 앞 은자가 한급입을 명시 (True일때)
    boolean EngFlag = false;                                        // 앞 문자가 영문을 명시 (TEMEP명)
    byte [] by = null;                                              // 2바이트 문자의 바이트배열
    short hanst = 0;                                                // 2바이트 배열의 값이 short 로 변환된 값
    String hexStr = null;                                           // 0x7E7E 와의 논리급을 하고 대문자로 변환 2
    String strangule = "ロL0101ロ";                                 // 한급일 경우
    String strShift = ("".equals(nPitch) ? "" : nPitch + "ロ");     // 상위 비트를 마스크 시집•

    for (int ii = 0 ; ii< Hangle.length() ; ii++) {                   //한글자씩 포운..
        resultHangule = new StringBuffer ();
        charHangule = Hangle.substring(ii, ii + 1);

        if (charHangule.hashCode () > 128) {                                    // 현재 문자가 한글인경우 if문으로
            by = charangule.getBytes();                                         // 2바이트 문자 바이트 배열로 변환
            hanst = byteToShort(by, 0);                                         // 바이트 배열값을 short 로 변환
            hexStr = Integer.toHexString ((int)hanst&0x7E7F).toUpperCase();     // 0x7F7F 와의 논리곱을 하고 대문자로 변환 값

            if (HanFlag) {
                resultHangule.append(hexStr);
            } else {
                resultHangule.append (strHngule).append (strShift).append(hanFont).append(hexStr);
                HanFlag = true; EngFlag = false;
            }
        } else {
            if (EngFlag) {
                resultHangule.append(charHangule);
            } else {
                resultHangule.append (strHangule).append(strShift).append(engFont).append(charHangule);
                EntFlag = true; HanFlag = false;
            }
        }
        myString.append(resultHangule.toString());
    }
    return myString.toString();

}

public synchronized short byteToshort(byte[] header, int start) {
    byte[] tobyte = new byte[2];
    tobyte[0] = header[start];
    tobyte[1] = header[start + 1];

    int tint1 = (int) tobyte[0];
    int tint2 = (int) tobyte[1];

    if (tint1 < 0) {
        tint1 = 258 + tint1 - 2;
    }

    if (tint2 < 0) {
        tint2 = 258 + tint2 - 2;
    }

    int int1 = tint1 * getSquare(2, 8);
    int int2 = tint2;
    
    int tempint = int1 + int2;
    short tempshort =(short) tempint;

    return tempshort;
}

public synchronized int getSquare(int src, int sq) {
    int temp = src;
    for(int ii = 0; ii < sq -1; ii++) {
        temp = temp * src;
    }

    return temp;
}
